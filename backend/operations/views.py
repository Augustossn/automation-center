import hmac
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, permissions, serializers, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiTypes
from .models import Lead, Task, IntegrationLog, AutomationRule, AgentRecommendation, Status, Channel
from .serializers import LeadSerializer, TaskSerializer, IntegrationLogSerializer, RuleSerializer, RecommendationSerializer
from .events import emit
from .privacy import mask

class OperatorPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and (request.method in permissions.SAFE_METHODS or request.user.is_staff or request.user.groups.filter(name='Operators').exists()))

class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.select_related('customer','channel').all()
    serializer_class = LeadSerializer
    permission_classes = [OperatorPermission]
    http_method_names = ['get','post','patch','head','options']
    filterset_fields = ['status','category','channel__slug','priority']
    search_fields = ['customer__name','customer__email','content']
    ordering_fields = ['created_at','priority','status']
    @extend_schema(request=None, responses=LeadSerializer)
    @action(detail=True, methods=['post'])
    def classify(self, request, pk=None):
        from .services import classify
        self.get_object()
        return Response(self.get_serializer(classify(pk)).data)
    @extend_schema(request=None, responses={202: OpenApiTypes.OBJECT})
    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        with transaction.atomic():
            lead = Lead.objects.select_for_update().get(pk=self.get_object().pk)
            lead.status = Status.NEW
            lead.save()
            event = emit(lead, 'lead.reprocessed', {'requestedBy': request.user.pk})
        return Response({'eventId': str(event.id), 'status': 'QUEUED'}, status=202)
    @extend_schema(responses=OpenApiTypes.OBJECT)
    @action(detail=True)
    def timeline(self, request, pk=None):
        lead = self.get_object()
        return Response({'events': [{'id': e.id, 'topic': e.topic, 'created_at': e.created_at, 'published': bool(e.published_at), 'processed': bool(e.processed_at)} for e in lead.events.all()], 'recommendations': RecommendationSerializer(lead.recommendations.all(), many=True).data})

class TaskStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Status.values)
    version = serializers.IntegerField(min_value=0)

class TaskViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Task.objects.select_related('lead__customer','lead__channel','assignment__assignee').all()
    serializer_class = TaskSerializer
    permission_classes = [OperatorPermission]
    filterset_fields = ['status','team','priority']
    @extend_schema(request=TaskStatusSerializer, responses={200: TaskSerializer, 409: OpenApiTypes.OBJECT})
    @action(detail=True, methods=['patch'], url_path='status')
    def set_status(self, request, pk=None):
        data = TaskStatusSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            task = Task.objects.select_for_update().get(pk=self.get_object().pk)
            if task.version != data.validated_data['version']:
                return Response({'detail': 'A tarefa foi alterada por outra pessoa. Atualize a fila.'}, status=409)
            previous = task.status
            task.status = data.validated_data['status']
            task.version += 1
            task.save()
            from .services import sync_lead_status
            sync_lead_status(Lead.objects.select_for_update().get(pk=task.lead_id))
            # All mutations are auditable; non-Kafka audit entries stay in the database.
            task.lead.events.create(topic='task.status_changed', payload={'taskId': str(task.id), 'from': previous, 'to': task.status, 'actor': request.user.pk}, published_at=timezone.now(), processed_at=timezone.now())
        return Response(self.get_serializer(task).data)

class LogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IntegrationLog.objects.all()
    serializer_class = IntegrationLogSerializer
    permission_classes = [OperatorPermission]
    filterset_fields = ['status','integration']
    @extend_schema(request=None, responses={202: OpenApiTypes.OBJECT, 409: OpenApiTypes.OBJECT})
    @action(detail=True, methods=['post'])
    def reprocess(self, request, pk=None):
        from .tasks import retry_integration
        with transaction.atomic():
            log = IntegrationLog.objects.select_for_update().get(pk=self.get_object().pk)
            if log.status not in ['FAILED','SUCCESS']:
                return Response({'detail': 'Já existe um processamento pendente'}, status=409)
            if log.status == 'SUCCESS':
                return Response({'detail': 'Integração concluída'}, status=409)
            log.status = 'PENDING'
            log.save()
            emit(log.lead, 'lead.reprocessed', {'logId': str(log.id), 'requestedBy': request.user.pk})
            transaction.on_commit(lambda: retry_integration.delay(str(log.id)))
        return Response({'status': 'QUEUED'}, status=202)

class RuleViewSet(viewsets.ModelViewSet):
    queryset = AutomationRule.objects.all()
    serializer_class = RuleSerializer
    permission_classes = [permissions.IsAdminUser]

class DecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=['APPROVED','REJECTED'])
    reason = serializers.CharField(max_length=2000)

class RecommendationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AgentRecommendation.objects.all()
    serializer_class = RecommendationSerializer
    permission_classes = [OperatorPermission]
    @extend_schema(request=DecisionSerializer, responses=RecommendationSerializer)
    @action(detail=True, methods=['post'])
    def decide(self, request, pk=None):
        data = DecisionSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            rec = AgentRecommendation.objects.select_for_update().get(pk=self.get_object().pk)
            if rec.decision != 'PENDING':
                return Response({'detail': 'Decisão já registrada'}, status=409)
            rec.decision = data.validated_data['decision']
            rec.reason = data.validated_data['reason']
            rec.decided_by = request.user
            rec.decided_at = timezone.now()
            rec.save()
        return Response(self.get_serializer(rec).data)

@extend_schema(responses=OpenApiTypes.OBJECT, description='Operational counts, SLA compliance, daily volume, channels and active automation rules.')
@api_view(['GET'])
def metrics(request):
    total = Lead.objects.count()
    tasks = Task.objects.all()
    open_tasks = tasks.exclude(status__in=['RESOLVED','FAILED'])
    breached = open_tasks.filter(due_at__lt=timezone.now()).count()
    return Response({'totalLeads': total, 'openTasks': open_tasks.count(), 'resolvedTasks': tasks.filter(status='RESOLVED').count(), 'slaBreached': breached, 'slaCompliance': round(100 * (1 - breached / max(open_tasks.count(), 1)), 1), 'integrationFailures': IntegrationLog.objects.filter(status='FAILED').count(), 'automations': AutomationRule.objects.filter(active=True).count(), 'channels': list(Lead.objects.values('channel__name').annotate(count=Count('id'))), 'statuses': list(Lead.objects.values('status').annotate(count=Count('id'))), 'daily': list(Lead.objects.extra(select={'day': 'date(created_at)'}).values('day').annotate(count=Count('id')).order_by('day'))})

@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(['GET'])
def me(request):
    return Response({'username': request.user.username, 'canWrite': request.user.is_staff or request.user.groups.filter(name='Operators').exists(), 'isAdmin': request.user.is_staff})

@extend_schema(responses=OpenApiTypes.OBJECT)
@api_view(['GET'])
def channels(request):
    return Response(list(Channel.objects.filter(active=True).values('slug','name')))

@extend_schema(request=LeadSerializer, responses={201: OpenApiTypes.OBJECT, 200: OpenApiTypes.OBJECT}, description='Simulated webhook. X-Webhook-Secret and Idempotency-Key headers required.')
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def webhook(request):
    if not hmac.compare_digest(request.headers.get('X-Webhook-Secret', ''), settings.WEBHOOK_SECRET):
        return Response({'detail': 'Invalid webhook signature'}, status=403)
    key = request.headers.get('Idempotency-Key', '')
    if not key or len(key) > 160:
        return Response({'detail': 'Idempotency-Key obrigatório, máximo 160 caracteres'}, status=400)
    existing = Lead.objects.filter(idempotency_key=key).first()
    if existing:
        return Response({'id': existing.id}, status=200)
    serializer = LeadSerializer(data={**request.data, 'idempotency_key': key})
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({'id': serializer.instance.id}, status=201)
