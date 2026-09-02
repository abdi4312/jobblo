jest.mock('./models/PushToken', () => ({
  find: jest.fn(() => ({
    select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue([]) })),
  })),
  findOneAndUpdate: jest.fn().mockResolvedValue(null),
  updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
  updateMany: jest.fn().mockResolvedValue({ acknowledged: true }),
  deleteMany: jest.fn().mockResolvedValue({ acknowledged: true }),
}));
