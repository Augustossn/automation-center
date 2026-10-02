import unicodedata
from django.db import transaction
from rest_framework import serializers
from .models import Customer, Channel, Lead, Task, AutomationRule, IntegrationLog, AgentRecommendation
from .events import emit
from .privacy import mask

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id','name','email','phone']
        read_only_fields = ['id']
    def validate_name(self, value):
        value = ' '.join(value.split())
        if not value:
            raise serializers.ValidationError('Informe o nome')
        return value
    def validate_email(self, value):
        return value.strip().lower()
    def validate_phone(self, value):
        normalized = ''.join(c for c in value if c.isdigit() or c == '+')
        if normalized and not 8 <= len(normalized.strip('+')) <= 15:
            raise serializers.ValidationError('Telefone inválido')
        return normalized

class LeadSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer()
    channel = serializers.SlugRelatedField(slug_field='slug', queryset=Channel.objects.filter(active=True))
    class Meta:
        model = Lead
        fields = ['id','customer','channel','content','status','category','priority','tags','created_at','updated_at','idempotency_key']
        read_only_fields = ['id','status','category','created_at','updated_at']
    def validate_content(self, value):
        value = unicodedata.normalize('NFKC', value).strip()
        if len(value) < 5 or len(value) > 10000:
            raise serializers.ValidationError('Conteúdo deve ter entre 5 e 10000 caracteres')
        return value
    @transaction.atomic
    def create(self, validated_data):
        customer = Customer.objects.create(**validated_data.pop('customer'))
        lead = Lead.objects.create(customer=customer, **validated_data)
        emit(lead, 'lead.created')
        return lead
    @transaction.atomic
    def update(self, instance, validated_data):
        customer_data = validated_data.pop('customer', None)
        if customer_data:
            for k,v in customer_data.items():
                setattr(instance.customer, k, v)
            instance.customer.save()
        return super().update(instance, validated_data)

class TaskSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='lead.customer.name', read_only=True)
    channel = serializers.CharField(source='lead.channel.slug', read_only=True)
    assignee = serializers.SerializerMethodField()
    def get_assignee(self, obj) -> str | None:
        assignment = getattr(obj, 'assignment', None)
        return assignment.assignee.username if assignment and assignment.assignee else None
    class Meta:
        model = Task
        fields = ['id','lead','title','team','priority','status','version','due_at','created_at','customer_name','channel','assignee']
        read_only_fields = fields

class IntegrationLogSerializer(serializers.ModelSerializer):
    payload = serializers.SerializerMethodField()
    def get_payload(self, obj) -> dict:
        return mask(obj.payload)
    class Meta:
        model = IntegrationLog
        fields = ['id','lead','integration','status','attempt','error','payload','created_at','updated_at']

class RuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationRule
        fields = '__all__'

class RecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRecommendation
        fields = ['id','result','decision','decided_by','decided_at','reason','created_at']
