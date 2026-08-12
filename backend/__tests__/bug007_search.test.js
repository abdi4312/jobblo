jest.mock('../models/Service', () => {
  const mockQuery = {
    populate: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue([
      {
        _id: '507f1f77bcf86cd799439011',
        title: 'House Cleaning',
        description: 'Deep house cleaning service',
        price: 500,
        categories: ['Cleaning'],
        location: { city: 'Oslo' },
      },
    ]),
  };

  return {
    find: jest.fn().mockReturnValue(mockQuery),
    countDocuments: jest.fn().mockResolvedValue(1),
  };
});

jest.mock('../models/NorwayMunicipality', () => ({
  find: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    }),
  }),
}));

const { getAllServices } = require('../controllers/serviceController');
const Service = require('../models/Service');

describe('BUG-007: Search API and Response Shape Verification', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      query: {
        search: 'cleaning',
        page: '1',
        limit: '16',
      },
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  it('should return services array and pagination object in standard format', async () => {
    await getAllServices(req, res);

    expect(Service.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.arrayContaining([
              { title: { $regex: 'cleaning', $options: 'i' } },
              { description: { $regex: 'cleaning', $options: 'i' } },
            ]),
          }),
        ]),
      })
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'House Cleaning',
            price: 500,
          }),
        ]),
        pagination: expect.objectContaining({
          total: 1,
          page: 1,
          limit: 16,
          totalPages: 1,
        }),
      })
    );
  });
});
