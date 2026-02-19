import { Request, Response } from "express";
import { z } from "zod";

const RememberSchema = z.object({
  agentId: z.string(),
  projectId: z.string().optional(),
  text: z.string(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  ttl: z.number().optional(),
});

export const rememberRoute = async (req: Request, res: Response) => {
  try {
    const data = RememberSchema.parse(req.body);
    
    // TODO: Embed text with Voyage
    // TODO: Store in MongoDB
    
    res.json({
      success: true,
      id: "temp-id",
      message: "Memory stored (not yet implemented)",
    });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
};
