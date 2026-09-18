from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db = None

    def connect(self):
        self.client = AsyncIOMotorClient(settings.MONGODB_URI)
        self.db = self.client["pdfAIReader"]
        print("Connected to MongoDB (Async via Motor)")

    async def create_indexes(self):
        """Create indexes on array ID fields to speed up lookups.
        Idempotent — safe to call on every startup."""
        users = self.db["users"]
        await users.create_index("events.id")
        await users.create_index("notebooks.id")
        await users.create_index("notes.id")
        print("MongoDB indexes ensured.")

    def close(self):
        self.client.close()

db = Database()

# Helper to get collections conveniently
def get_collection(name: str):
    return db.db[name]
