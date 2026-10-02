import re
import requests
from django.conf import settings
from django.db.models import Q
from rest_framework import serializers
from .models import Lead, AutomationRule, AgentRecommendation
from .privacy import SENSITIVE, mask

class RecommendationSchema(serializers.Serializer):
    category = serializers.CharField(max_length=80)
    priority = serializers.ChoiceField(choices=['LOW','MEDIUM','HIGH','URGENT'])
    extractedEntities = serializers.JSONField()
    confidence = serializers.FloatField(min_value=0, max_value=1)
    suggestedTeam = serializers.CharField(max_length=80)
    recommendedAction = serializers.CharField()
    draftResponse = serializers.CharField(allow_null=True, allow_blank=True)
    requiresHumanApproval = serializers.BooleanField()

class MockAdapter:
    def recommend(self, lead):
        text = lead.content.lower()
        category = 'sales' if any(k in text for k in ['preço', 'orcamento', 'orçamento', 'comprar', 'plano']) else 'support' if any(k in text for k in ['erro','problema','acesso','falha']) else 'other'
        confidence = 0.94 if category != 'other' else 0.63
        return {'category': category, 'priority': 'HIGH' if 'urgente' in text else 'MEDIUM', 'extractedEntities': {'emails': re.findall(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', lead.content)}, 'confidence': confidence, 'suggestedTeam': 'Comercial' if category == 'sales' else 'Suporte', 'recommendedAction': 'Criar tarefa interna e revisar o atendimento', 'draftResponse': 'Olá! Recebemos sua solicitação. Nossa equipe dará continuidade ao atendimento.', 'requiresHumanApproval': True}

class RemoteAdapter:
    def recommend(self, lead):
        if not settings.AGENT_API_URL or not settings.AGENT_API_KEY:
            raise ValueError('Real adapter requires AGENT_API_URL and AGENT_API_KEY')
        response = requests.post(settings.AGENT_API_URL, json={'content': mask(lead.content), 'channel': lead.channel.slug, 'instruction': 'Return OperationsAgent JSON only. Do not contact customers.'}, headers={'Authorization': f'Bearer {settings.AGENT_API_KEY}'}, timeout=20)
        response.raise_for_status()
        return response.json()

class OperationsAgent:
    def getLead(self, leadId):
        return Lead.objects.select_related('channel').get(id=leadId)

    def searchAutomationRules(self, channel, category):
        return AutomationRule.objects.filter(Q(channel__slug=channel) | Q(channel__isnull=True), active=True, category=category)

    def createInternalTask(self, leadId, team, priority):
        from .services import create_task
        return create_task(self.getLead(leadId), team, priority)

    def addTag(self, leadId, tag):
        lead = self.getLead(leadId)
        lead.tags = sorted(set([*lead.tags, tag]))
        lead.save(update_fields=['tags', 'updated_at'])

    def requestHumanReview(self, leadId, reason):
        from .services import create_task
        return create_task(self.getLead(leadId), 'Revisão humana', 'HIGH', title=reason[:180])

    def run(self, leadId):
        lead = self.getLead(leadId)
        adapter = MockAdapter() if settings.AGENT_ADAPTER == 'mock' else RemoteAdapter()
        serializer = RecommendationSchema(data=adapter.recommend(lead))
        serializer.is_valid(raise_exception=True)
        result = dict(serializer.validated_data)
        result['extractedEntities'] = mask(result['extractedEntities'])
        result['requiresHumanApproval'] = True
        if SENSITIVE.search(lead.content):
            result['draftResponse'] = None
            self.requestHumanReview(leadId, 'Informação sensível — revisão obrigatória')
        elif result['confidence'] < 0.80:
            self.requestHumanReview(leadId, 'Baixa confiança — revisão obrigatória')
        else:
            result['draftResponse'] = mask(result['draftResponse'])
        return AgentRecommendation.objects.create(lead=lead, result=result)
