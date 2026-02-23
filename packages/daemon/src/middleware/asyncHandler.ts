import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async route handler so rejected promises are forwarded
 * to Express's error handler instead of crashing the process.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
