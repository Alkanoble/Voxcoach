import json
import firebase_admin
from firebase_admin import credentials, firestore, storage, auth
from .config import settings

_firestore_client = None
_storage_bucket = None

def init_firebase():
    global _firestore_client, _storage_bucket
    
    if firebase_admin._apps:
        # Already initialized
        return
        
    cred = None
    if settings.firebase_service_account_json:
        cred_dict = json.loads(settings.firebase_service_account_json)
        cred = credentials.Certificate(cred_dict)
    elif settings.firebase_service_account_path:
        cred = credentials.Certificate(settings.firebase_service_account_path)
    else:
        raise ValueError("Missing Firebase credentials configuration.")

    app = firebase_admin.initialize_app(cred, {
        'storageBucket': settings.firebase_storage_bucket
    })
    
    _firestore_client = firestore.client()
    _storage_bucket = storage.bucket()

def get_firestore():
    global _firestore_client
    if not _firestore_client:
        init_firebase()
    return _firestore_client

def get_bucket():
    global _storage_bucket
    if not _storage_bucket:
        init_firebase()
    return _storage_bucket

def verify_token(id_token: str):
    return auth.verify_id_token(id_token)
