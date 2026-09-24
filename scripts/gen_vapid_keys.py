"""Genere une paire de cles VAPID pour les notifications push.

    python scripts/gen_vapid_keys.py

Copier les deux lignes affichees dans les variables d'environnement du projet
API (Vercel), avec VAPID_SUBJECT=mailto:votre@adresse. Les cles se gardent :
en changer invalide les abonnements existants (il faut reactiver les
notifications sur chaque telephone)."""
import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def generate() -> tuple[str, str]:
    key = ec.generate_private_key(ec.SECP256R1())
    private = key.private_numbers().private_value.to_bytes(32, "big")
    public = key.public_key().public_bytes(serialization.Encoding.X962,
                                           serialization.PublicFormat.UncompressedPoint)
    return _b64url(public), _b64url(private)


if __name__ == "__main__":
    pub, priv = generate()
    print(f"VAPID_PUBLIC_KEY={pub}")
    print(f"VAPID_PRIVATE_KEY={priv}")
