import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { ApiSuccessResponse } from '../utils/apiResponse';
import { CreateGreetingInput } from '../validations/example.validation';

const buildGreeting = (input: CreateGreetingInput) => ({
  greeting: `${input.message}, ${input.name}!`,
  createdAt: new Date().toISOString(),
});

export const createGreeting = catchAsync(async (req: Request, res: Response) => {
  const input = req.body as CreateGreetingInput;
  const data = buildGreeting(input);

  const response: ApiSuccessResponse<typeof data> = {
    success: true,
    message: 'Greeting created successfully',
    data,
  };

  res.status(201).json(response);
});
