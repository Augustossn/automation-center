from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from operations import views
from django.http import JsonResponse

router = DefaultRouter(trailing_slash=False)
router.register('leads', views.LeadViewSet)
router.register('tasks', views.TaskViewSet)
router.register('integration-logs', views.LogViewSet)
router.register('automation-rules', views.RuleViewSet)
router.register('recommendations', views.RecommendationViewSet)
health = path('health', lambda request: JsonResponse({'status': 'ok'}))
urlpatterns = [path('admin/', admin.site.urls), path('api/dashboard/metrics', views.metrics), path('api/me', views.me), path('api/channels', views.channels), path('api/webhooks/leads', views.webhook), path('api/', include(router.urls)), path('api/schema', SpectacularAPIView.as_view(), name='schema'), path('api/docs', SpectacularSwaggerView.as_view(url_name='schema')), path('', include('django_prometheus.urls'))]
urlpatterns.append(health)
