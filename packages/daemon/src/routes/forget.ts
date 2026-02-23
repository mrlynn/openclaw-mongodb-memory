import { Request, Response } from "express";
import { Db, ObjectId } from "mongodb";
import { asyncHandler } from "../middleware/asyncHandler";
import { COLLECTION_MEMORIES } from "../constants";

export const forgetRoute = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ success: false, error: "Invalid memory ID" });
    return;
  }

  const db: Db = req.app.locals.db;
  const collection = db.collection(COLLECTION_MEMORIES);

  const result = await collection.deleteOne({ _id: new ObjectId(id) });

  if (result.deletedCount === 0) {
    res.status(404).json({ success: false, error: "Memory not found" });
    return;
  }

  res.json({ success: true, id, message: "Memory deleted" });
});
