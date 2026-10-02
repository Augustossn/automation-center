import os
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db import transaction
from django.utils import timezone
from operations.models import Channel, Customer, Lead, Task, IntegrationLog, AutomationRule, Status
from operations.services import classify, sync_lead_status
from operations.events import emit
from operations.privacy import mask

class Command(BaseCommand):
    help = 'Seed fictional demo records. Requires DEMO_PASSWORD.'
    @transaction.atomic
    def handle(self, *args, **options):
        password = os.getenv('DEMO_PASSWORD')
        if not password:
            raise ValueError('Set DEMO_PASSWORD before seeding')
        user, created = get_user_model().objects.get_or_create(username='demo', defaults={'is_staff': True})
        if created:
            user.set_password(password)
            user.save()
        operators, _ = Group.objects.get_or_create(name='Operators')
        user.groups.add(operators)
        channels = {slug: Channel.objects.get_or_create(slug=slug, defaults={'name': name})[0] for slug,name in [('whatsapp','WhatsApp'),('email','E-mail'),('website','Website'),('api','API') ]}
        for category,team in [('sales','Comercial'),('support','Suporte')]:
            AutomationRule.objects.get_or_create(name=f'Encaminhar {category}', defaults={'category': category, 'team': team})
            group, _ = Group.objects.get_or_create(name=team)
            user.groups.add(group)
        names = ['Marina Costa','Lucas Oliveira','Ana Ribeiro','Pedro Santos','Camila Rocha','Rafael Lima','Beatriz Alves','Gabriel Souza','Julia Martins','Felipe Araujo','Laura Mendes','Bruno Dias']
        for i,name in enumerate(names):
            key = f'demo-{i}'
            if Lead.objects.filter(idempotency_key=key).exists():
                continue
            customer = Customer.objects.create(name=name, email=f'contato{i}@example.com')
            lead = Lead.objects.create(customer=customer, channel=list(channels.values())[i % 4], content=['Quero orçamento para o plano empresarial', 'Problema no acesso à plataforma, urgente', 'Preciso falar com alguém sobre uma solicitação'][i % 3], idempotency_key=key)
            emit(lead, 'lead.created')
            Lead.objects.filter(pk=lead.pk).update(created_at=timezone.now()-timedelta(days=i%7))
            classify(lead.id)
            task = lead.tasks.exclude(team='Revisão humana').first()
            task.status = ['ASSIGNED','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED'][i % 4]
            task.due_at = timezone.now() + timedelta(hours=i-2)
            task.save()
            sync_lead_status(lead)
            if i % 3 == 0:
                IntegrationLog.objects.filter(lead=lead).update(status='FAILED', attempt=5, error='CRM indisponível; limite de tentativas atingido', payload=mask({'leadId': str(lead.id), 'email': customer.email, 'content': lead.content}))
        self.stdout.write(self.style.SUCCESS('Dados fictícios criados. Usuário: demo'))
