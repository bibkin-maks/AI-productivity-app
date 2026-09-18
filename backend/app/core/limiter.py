from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter instance — import this in both app/main.py and any router
# that needs rate-limit decorators. Keeping it here breaks the circular import
# that would arise from routers importing from app.main.
limiter = Limiter(key_func=get_remote_address)
