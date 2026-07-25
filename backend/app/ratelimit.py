from slowapi import Limiter
from slowapi.util import get_remote_address

# Per-client-IP rate limiter. In-memory, so limits are per process; a multi-process
# or multi-host deployment would point this at Redis via a storage_uri.
limiter = Limiter(key_func=get_remote_address)
