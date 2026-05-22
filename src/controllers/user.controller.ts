import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { ApiSuccessResponse } from '../utils/apiResponse';
import { CreateUserInput } from '../validations/user.validation';
import * as userService from '../services/user.service';
import { UserRecord } from '../services/user.service';

type PublicUser = {
  id: number;
  name: string;
  email: string;
  created_at: Date;
  updated_at: Date;
};

const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
});

export const getUsers = catchAsync(async (_req: Request, res: Response) => {
  const users = await userService.findAllUsers();

  const response: ApiSuccessResponse<PublicUser[]> = {
    success: true,
    data: users.map(toPublicUser),
  };

  res.json(response);
});

export const createUser = catchAsync(async (req: Request, res: Response) => {
  const input = req.body as CreateUserInput;

  const existing = await userService.findUserByEmail(input.email);
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const user = await userService.createUser(input);

  const response: ApiSuccessResponse<PublicUser> = {
    success: true,
    message: 'User created successfully',
    data: toPublicUser(user),
  };

  res.status(201).json(response);
});
