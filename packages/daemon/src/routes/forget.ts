import { Request, Response } from "express";

export const forgetRoute = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // TODO: Delete from MongoDB
    
    res.json({
      success: true,
      message: "Memory deleted (not yet implemented)",
    });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
};
