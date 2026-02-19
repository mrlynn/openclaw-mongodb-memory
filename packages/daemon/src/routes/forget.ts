import { Request, Response } from "express";
import { MongoClient, ObjectId } from "mongodb";

export const forgetRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid memory ID" });
      return;
    }

    const mongoClient: MongoClient = req.app.locals.mongoClient;
    const db = mongoClient.db("openclaw_memory");
    const collection = db.collection("memories");

    const result = await collection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }

    res.json({
      success: true,
      id,
      message: "Memory deleted",
    });
  } catch (error) {
    console.error("Forget error:", error);
    res.status(500).json({ error: String(error) });
  }
};
