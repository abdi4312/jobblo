jest.mock('../models/User', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../models/Category', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  find: jest.fn(),
}));
jest.mock('../models/List', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  find: jest.fn(),
}));
jest.mock('../models/Service', () => ({
  find: jest.fn(),
  countDocuments: jest.fn().mockResolvedValue(0),
}));
jest.mock('../models/Order', () => ({
  aggregate: jest.fn().mockResolvedValue([]),
  countDocuments: jest.fn().mockResolvedValue(0),
  find: jest.fn(),
}));
jest.mock('../models/JobRequest', () => ({
  countDocuments: jest.fn().mockResolvedValue(0),
  find: jest.fn(),
}));
jest.mock('../models/Review', () => ({ find: jest.fn() }));

const User = require('../models/User');
const Category = require('../models/Category');
const List = require('../models/List');
const Service = require('../models/Service');
const userController = require('../controllers/userController');
const exploreController = require('../controllers/exploreController');

const resolvedQuery = (value) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('soft-deleted users stay out of active discovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.find.mockReturnValue(resolvedQuery([]));
    User.findOne.mockReturnValue(resolvedQuery(null));
    User.countDocuments.mockResolvedValue(0);
    Category.find.mockReturnValue(resolvedQuery([]));
    List.find.mockReturnValue(resolvedQuery([]));
    Service.find.mockReturnValue(resolvedQuery([]));
  });

  it('excludes deleted users from user search while keeping active users eligible', async () => {
    const res = response();

    await userController.searchUsers({ query: { query: 'ann' }, userId: 'current-user' }, res);

    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: { $ne: true } })
    );
    expect(User.find.mock.calls[0][0]).toEqual(
      expect.objectContaining({ _id: { $ne: 'current-user' } })
    );
  });

  it('excludes deleted users from both unified people search branches', async () => {
    const res = response();
    const req = { query: { query: 'ann', type: 'people' }, userId: 'current-user' };

    await userController.searchAll(req, res);
    expect(User.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: { $ne: true } })
    );
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: { $ne: true } })
    );

    jest.clearAllMocks();
    User.find.mockReturnValue(resolvedQuery([]));
    User.countDocuments.mockResolvedValue(0);
    await userController.searchAll({ query: { query: 'ann' }, userId: 'current-user' }, res);

    expect(User.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: { $ne: true } })
    );
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: { $ne: true } })
    );
  });

  it('excludes deleted users from top and recommended users', async () => {
    const res = response();

    await userController.getTopUsers({ query: {}, userId: 'current-user' }, res);
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: { $ne: true } })
    );

    jest.clearAllMocks();
    User.find.mockReturnValue(resolvedQuery([]));
    await exploreController.getFeaturedFavourites({ query: {} }, res);
    expect(User.find).toHaveBeenCalledWith(
      expect.objectContaining({ isDeleted: { $ne: true } })
    );
  });

  it('returns 404 for a deleted public profile without changing historical records', async () => {
    const res = response();

    await userController.getUserById(
      { params: { id: '507f1f77bcf86cd799439011' }, userId: 'another-user' },
      res
    );

    expect(User.findOne).toHaveBeenCalledWith({
      _id: '507f1f77bcf86cd799439011',
      isDeleted: { $ne: true },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(User).not.toHaveProperty('deleteMany');
  });

  it('keeps admin deleted-user visibility explicitly available', async () => {
    const adminController = require('../controllers/admin/usersAdminController');
    const res = response();
    User.find.mockReturnValue(resolvedQuery([]));
    User.countDocuments.mockResolvedValue(0);

    await adminController.getUsers({ query: { showDeleted: 'true' } }, res);

    expect(User.find).toHaveBeenCalledWith({ isDeleted: true });
    expect(User.countDocuments).toHaveBeenCalledWith({ isDeleted: true });
  });
});
