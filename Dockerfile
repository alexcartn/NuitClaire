# Image de l'API (api/) pour un hebergeur avec disque persistant (Railway,
# Fly.io...) -- pas pour Vercel par defaut : voir la note dans README.md sur
# pourquoi les fonctions serverless de Vercel ne conviennent pas a la
# persistance par fichiers JSON (progress.py/settings.py/sessions.py). Si
# SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY sont definies (voir README.md), ces
# trois modules ecrivent dans Supabase au lieu du disque local et cette
# contrainte disparait -- cette image reste toutefois la voie recommandee
# pour un hebergeur a disque persistant. N'installe QUE ce dont l'API a
# besoin (pas streamlit/altair, reserves a app.py).
FROM python:3.12-slim

# ephem est une extension C sans wheel manylinux pour toutes les plateformes
# -- gcc permet de la compiler depuis la source si besoin.
RUN apt-get update && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
COPY api/requirements-api.txt ./api/requirements-api.txt
RUN pip install --no-cache-dir -r requirements.txt -r api/requirements-api.txt

COPY . .

EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
