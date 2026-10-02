import re

SENSITIVE = re.compile(r'\b(?:senha|password|cpf|cartão|cartao|saúde|saude|diagnóstico|diagnostico)\b|\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b', re.I)

def mask(value):
    if isinstance(value, dict):
        return {k: ('[REDACTED]' if any(s in k.lower() for s in ['email','phone','password','token','secret','content','cpf','name']) else mask(v)) for k,v in value.items()}
    if isinstance(value, list):
        return [mask(v) for v in value]
    if isinstance(value, str):
        value = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[EMAIL]', value)
        value = re.sub(r'\+?\d[\d\s().-]{7,}\d', '[NUMBER]', value)
        return '[SENSITIVE]' if SENSITIVE.search(value) else value
    return value
