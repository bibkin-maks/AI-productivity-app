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
        """Indexes for the per-user collections. Idempotent — safe on every startup."""
        await self.db["events"].create_index([("user_id", 1), ("start", 1)])
        await self.db["events"].create_index([("user_id", 1), ("seriesId", 1)])
        await self.db["notebooks"].create_index([("user_id", 1), ("created_at", 1)])
        await self.db["notes"].create_index([("user_id", 1), ("notebook_id", 1), ("order", 1)])
        await self.db["notes"].create_index([("user_id", 1), ("updated_at", -1)])
        await self.db["chunks"].create_index([("user_id", 1), ("index", 1)])
        print("MongoDB indexes ensured.")

    def close(self):
        self.client.close()

db = Database()

# Helper to get collections conveniently
def get_collection(name: str):
    return db.db[name]
