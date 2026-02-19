import { Request, Response } from "express";
import { MongoClient } from "mongodb";

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  database: {
    connected: boolean;
    responseTime: number;
    memoriesCount?: number;
    error?: string;
  };
  voyage: {
    configured: boolean;
    mode: "mock" | "real";
    endpoint: string;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
  checks: {
    mongodb: boolean;
    voyage: boolean;
    memory: boolean;
  };
}

export const healthRoute = async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const mongoClient: MongoClient = req.app.locals.mongoClient;
    const voyageApiKey: string = req.app.locals.voyageApiKey;
    const voyageBaseUrl: string | undefined = req.app.locals.voyageBaseUrl;
    const useMock = process.env.VOYAGE_MOCK === "true";

    // 1. Check MongoDB
    let mongoHealthy = false;
    let mongoResponseTime = 0;
    let memoriesCount = 0;
    let mongoError: string | undefined;

    try {
      const checkStart = Date.now();
      const db = mongoClient.db("openclaw_memory");
      const collection = db.collection("memories");

      // Ping the database
      await db.admin().ping();
      mongoResponseTime = Date.now() - checkStart;

      // Get memory count
      memoriesCount = await collection.countDocuments();
      mongoHealthy = true;
    } catch (error) {
      mongoError = `MongoDB check failed: ${String(error)}`;
      mongoHealthy = false;
    }

    // 2. Check Voyage configuration
    const voyageConfigured = !!voyageApiKey;
    const voyageMode = useMock ? "mock" : "real";
    const voyageEndpoint = voyageBaseUrl || "https://api.voyageai.com/v1";

    // 3. Get memory stats
    const memUsage = process.process?.memoryUsage?.() || process.memoryUsage();

    // 4. Determine overall status
    const allChecksPass = mongoHealthy && voyageConfigured;
    const overallStatus: HealthStatus["status"] = allChecksPass
      ? "healthy"
      : mongoHealthy && !voyageConfigured
        ? "degraded"
        : "unhealthy";

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      database: {
        connected: mongoHealthy,
        responseTime: mongoResponseTime,
        memoriesCount: mongoHealthy ? memoriesCount : undefined,
        error: mongoError,
      },
      voyage: {
        configured: voyageConfigured,
        mode: voyageMode,
        endpoint: voyageEndpoint,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      checks: {
        mongodb: mongoHealthy,
        voyage: voyageConfigured,
        memory: memUsage.heapUsed / memUsage.heapTotal < 0.9, // Healthy if <90% heap used
      },
    };

    const responseTime = Date.now() - startTime;

    res.status(overallStatus === "healthy" ? 200 : 503).json({
      ...health,
      responseTime,
    });
  } catch (error) {
    console.error("[Health] Unexpected error:", error);
    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: String(error),
    });
  }
};
