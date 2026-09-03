const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');

const ENTITLEMENT_FIELDS = [
  'freeContact',
  'perContactPrice',
  'ContactUnlock',
  'maxJobsValue',
  'maxContact',
  'radius',
  'visibilityLevel',
  'locationPrecision',
  'hasBadge',
  'hasAnalytics',
];

function bad(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function validatePlanPayload(input, existing = {}) {
  const data = {
    name: input.name ?? existing.name,
    price: input.price ?? existing.price,
    type: input.type ?? existing.type,
    isActive: input.isActive ?? existing.isActive,
    featuresText: input.featuresText ?? existing.featuresText ?? [],
    entitlements: { ...(existing.entitlements?.toObject?.() || existing.entitlements || {}) },
  };
  const suppliedEntitlements = input.entitlements || {};
  for (const field of ENTITLEMENT_FIELDS) {
    if (field in suppliedEntitlements) data.entitlements[field] = suppliedEntitlements[field];
  }

  if (typeof data.name !== 'string' || !data.name.trim())
    throw bad('name must be a non-empty string');
  if (!Number.isFinite(data.price) || data.price < 0)
    throw bad('price must be a finite number >= 0');
  if (!['private', 'business'].includes(data.type)) throw bad('type must be private or business');
  if (typeof data.isActive !== 'boolean') throw bad('isActive must be boolean');
  if (
    !Array.isArray(data.featuresText) ||
    data.featuresText.some((value) => typeof value !== 'string')
  ) {
    throw bad('featuresText must be an array of strings');
  }

  const integerFields = ['freeContact', 'ContactUnlock', 'maxContact'];
  for (const field of integerFields) {
    if (!Number.isInteger(data.entitlements[field]) || data.entitlements[field] < 0) {
      throw bad(`${field} must be an integer >= 0`);
    }
  }
  const numberFields = ['perContactPrice', 'radius', 'visibilityLevel'];
  for (const field of numberFields) {
    if (!Number.isFinite(data.entitlements[field]) || data.entitlements[field] < 0) {
      throw bad(`${field} must be a finite number >= 0`);
    }
  }
  if (
    data.entitlements.maxJobsValue != null &&
    (!Number.isFinite(data.entitlements.maxJobsValue) || data.entitlements.maxJobsValue < 0)
  ) {
    throw bad('maxJobsValue must be null or a finite number >= 0');
  }
  if (!['exact', 'approximate'].includes(data.entitlements.locationPrecision)) {
    throw bad('locationPrecision must be exact or approximate');
  }
  for (const field of ['hasBadge', 'hasAnalytics']) {
    if (typeof data.entitlements[field] !== 'boolean') throw bad(`${field} must be boolean`);
  }
  return {
    name: data.name.trim(),
    price: data.price,
    type: data.type,
    isActive: data.isActive,
    featuresText: data.featuresText.map((value) => value.trim()).filter(Boolean),
    entitlements: data.entitlements,
  };
}

async function hasSubscriptionReference(id) {
  return Subscription.exists({
    $or: [{ 'currentPlan.planId': id }, { 'planHistory.planId': id }],
  });
}

exports.getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find(); // Admin might want to see inactive ones too
    res.status(200).json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching plans' });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await SubscriptionPlan.findById(id);
    if (!existing) return res.status(404).json({ message: 'Plan not found' });
    const updateData = validatePlanPayload(req.body, existing);
    if (
      (updateData.name !== existing.name || updateData.type !== existing.type) &&
      (await hasSubscriptionReference(id))
    ) {
      return res
        .status(409)
        .json({
          message: 'Cannot change identity of a referenced plan',
          code: 'plan_identity_in_use',
        });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.status(200).json({ message: 'Plan updated successfully', plan });
  } catch (err) {
    console.error('Update plan error:', err);
    res
      .status(err.statusCode || 500)
      .json({ message: err.statusCode ? err.message : 'Server error updating plan' });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const newPlan = new SubscriptionPlan(validatePlanPayload(req.body));
    await newPlan.save();
    res.status(201).json({ message: 'Plan created successfully', plan: newPlan });
  } catch (err) {
    console.error(err);
    res
      .status(err.statusCode || 500)
      .json({ message: err.statusCode ? err.message : 'Server error creating plan' });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    if (await hasSubscriptionReference(id)) {
      return res
        .status(409)
        .json({ message: 'Cannot delete a referenced plan', code: 'plan_in_use' });
    }
    const plan = await SubscriptionPlan.findByIdAndDelete(id);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    res.status(200).json({ message: 'Plan deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting plan' });
  }
};
