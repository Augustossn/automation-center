import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'local-development-only-change-me')
DEBUG = os.environ.get('DEBUG', '0') == '1'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,backend,testserver').split(',')
INSTALLED_APPS = ['django.contrib.auth', 'django.contrib.contenttypes', 'django.contrib.sessions', 'django.contrib.admin', 'django.contrib.messages', 'django.contrib.staticfiles', 'rest_framework', 'django_filters', 'corsheaders', 'drf_spectacular', 'django_prometheus', 'operations']
MIDDLEWARE = ['django_prometheus.middleware.PrometheusBeforeMiddleware', 'corsheaders.middleware.CorsMiddleware', 'django.middleware.security.SecurityMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware', 'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware', 'django.contrib.auth.middleware.AuthenticationMiddleware', 'django.contrib.messages.middleware.MessageMiddleware', 'django_prometheus.middleware.PrometheusAfterMiddleware']
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True, 'OPTIONS': {'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
DATABASES = {'default': {'ENGINE': 'django.db.backends.postgresql', 'NAME': os.getenv('POSTGRES_DB', 'automation'), 'USER': os.getenv('POSTGRES_USER', 'automation'), 'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'automation-local'), 'HOST': os.getenv('POSTGRES_HOST', 'postgres'), 'PORT': os.getenv('POSTGRES_PORT', '5432')}}
if os.getenv('SQLITE_TEST') == '1':
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'dev.sqlite3'}}
AUTH_PASSWORD_VALIDATORS = []
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:8080').split(',')
REST_FRAMEWORK = {'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework.authentication.BasicAuthentication', 'rest_framework.authentication.SessionAuthentication'], 'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'], 'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema', 'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend', 'rest_framework.filters.SearchFilter', 'rest_framework.filters.OrderingFilter'], 'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination', 'PAGE_SIZE': 20, 'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.UserRateThrottle'], 'DEFAULT_THROTTLE_RATES': {'user': '300/min'}}
SPECTACULAR_SETTINGS = {'TITLE': 'Automation Center API', 'VERSION': '1.0.0', 'COMPONENT_SPLIT_REQUEST': True, 'ENUM_NAME_OVERRIDES': {'WorkflowStatus': 'operations.models.Status.choices', 'IntegrationStatus': ['PENDING','RETRYING','SUCCESS','FAILED']}}
CELERY_BROKER_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
CELERY_TASK_ALWAYS_EAGER = os.getenv('CELERY_EAGER', '0') == '1'
CELERY_BEAT_SCHEDULE = {'outbox': {'task': 'operations.tasks.flush_outbox', 'schedule': 5.0}, 'sla': {'task': 'operations.tasks.check_sla', 'schedule': 60.0}, 'integrations': {'task': 'operations.tasks.dispatch_integrations', 'schedule': 15.0}}
KAFKA_BOOTSTRAP_SERVERS = os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'kafka:9092')
KAFKA_TOPIC_PREFIX = os.getenv('KAFKA_TOPIC_PREFIX', 'automation-center.')
AGENT_ADAPTER = os.getenv('AGENT_ADAPTER', 'mock')
AGENT_API_URL = os.getenv('AGENT_API_URL', '')
AGENT_API_KEY = os.getenv('AGENT_API_KEY', '')
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET', 'local-webhook-secret')
INTEGRATION_URL = os.getenv('INTEGRATION_URL', '')
LOGGING = {'version': 1, 'disable_existing_loggers': False, 'formatters': {'json': {'()': 'pythonjsonlogger.json.JsonFormatter', 'format': '%(asctime)s %(levelname)s %(name)s %(message)s'}}, 'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'json'}}, 'root': {'handlers': ['console'], 'level': 'INFO'}}
