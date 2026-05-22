import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiSuccessResponse } from '../utils/apiResponse';

export const getHealth = catchAsync(async (_req: Request, res: Response) => {
  const response: ApiSuccessResponse<{ status: string; uptime: number }> = {
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
    },
  };

  res.json(response);
});
