#!/usr/bin/env python3
"""Build and deploy static assets; fetch the SWA deployment token privately from Azure CLI."""
import argparse
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api-url', required=True, help='Origen HTTPS del backend Container Apps, sin /api/v1.')
    parser.add_argument('--resource-group', default='rg-whoami-prod')
    parser.add_argument('--app-name', default='whoami-frontend')
    parser.add_argument('--subscription', default='653071f3-a6e1-447a-8961-3c972e025a41')
    args = parser.parse_args()
    origin = args.api_url.rstrip('/')
    parts = urlsplit(origin)
    if parts.scheme != 'https' or not parts.hostname or parts.path or parts.query or parts.fragment or parts.username:
        raise ValueError('--api-url debe ser solo el origen HTTPS del backend.')
    env = dict(os.environ)
    # Never load backend .env for a frontend build.
    for key in ('DATABASE_URL','DATABASE_USER','DATABASE_PASSWORD','WHOAMI_ENCRYPTION_KEY','SUPABASE_SECRET_KEY',
                'RESEND_API_KEY','R2_ACCESS_KEY','R2_SECRET_KEY'):
        env.pop(key, None)
    env['VITE_API_BASE_URL'] = origin
    subprocess.run(['npm', 'run', 'build'], cwd=ROOT, env=env, check=True)
    if not (ROOT / 'dist/staticwebapp.config.json').is_file():
        raise ValueError('Falta la configuración SPA en dist; no desplegar.')
    result = subprocess.run(['az', 'staticwebapp', 'secrets', 'list', '--name', args.app_name,
                             '--resource-group', args.resource_group, '--subscription', args.subscription,
                             '--query', 'properties.apiKey', '--output', 'json', '--only-show-errors'],
                            capture_output=True, text=True, check=True)
    token = json.loads(result.stdout)
    if not token:
        raise ValueError('Azure no devolvió un token de despliegue.')
    env['SWA_CLI_DEPLOYMENT_TOKEN'] = token
    env['CI'] = 'true'
    print('Publicando dist en Static Web Apps; token solo en el entorno del proceso.', flush=True)
    deployed = subprocess.run(['npx', '--yes', '@azure/static-web-apps-cli@2.1.0', 'deploy', 'dist',
                              '--env', 'production', '--no-use-keychain'], cwd=ROOT, env=env,
                             capture_output=True, text=True)
    # Official CLI logs are redacted before returning to the user.
    print((deployed.stdout + deployed.stderr).replace(token, '[REDACTED]'))
    if deployed.returncode:
        raise RuntimeError('La publicación de Static Web Apps falló; revisar el estado antes de reintentar.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error) if not isinstance(error, subprocess.CalledProcessError) else 'No se pudo compilar u obtener acceso de despliegue en Azure.', file=__import__('sys').stderr)
        raise SystemExit(1)
