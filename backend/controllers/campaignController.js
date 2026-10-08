const crypto = require('crypto');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const CampaignEvent = require('../models/CampaignEvent');

const DEFAULT_SLUG = 'safe-pay-giveaway';
const DEFAULT_DISCLAIMER =
  'For å kvalifisere til trekningen må en jobb være publisert, gjennomført og betalt via Jobblo SafePay i kampanjeperioden. Vinneren velges tilfeldig blant alle kvalifiserte deltakere og mottar en premie på 5 000 kr. Deltakelse eller gjennomføring av en jobb garanterer ikke gevinst. Jobber som kanselleres, refunderes eller på annen måte ikke fullføres, kvalifiserer ikke. Eventuelle forsøk på misbruk eller manipulering kan føre til diskvalifisering. Vinneren kontaktes direkte av Jobblo. Fullstendige kampanjevilkår gjelder.';
const DEFAULTS = () => {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  return {
    slug: DEFAULT_SLUG,
    name: 'Jobblo SafePay 5 000 kr giveaway',
    enabled: false,
    startDate,
    endDate,
    bannerText:
      'Legg ut en jobb og få den fullført med Jobblo SafePay – så er du automatisk med i trekningen av 5 000 kr. En fullført jobb = ett lodd.',
    bannerCtaLabel: 'Legg ut en jobb',
    bannerCtaUrl: '/Publish-job',
    popupVersionA:
      'Legg ut en jobb og få den fullført med Jobblo SafePay – og få sjansen til å vinne 5 000 kr!',
    popupVersionB: 'Din neste jobb kan være verdt 5 000 kr, legg ut en jobb og bli med!',
    popupCtaLabel: 'Legg ut en jobb',
    popupCtaUrl: '/Publish-job',
    popupDelayMs: 2500,
    popupCooldownMs: 86400000,
    termsLabel: 'Se vilkår',
    termsUrl: '/kampanjevilkar',
    disclaimer: DEFAULT_DISCLAIMER,
  };
};

const ensureDefaultCampaign = async () => {
  const defaults = DEFAULTS();
  return Campaign.findOneAndUpdate(
    { slug: DEFAULT_SLUG },
    { $setOnInsert: defaults },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).select('+assignmentSecret');
};

const isLocalPath = (value) =>
  typeof value === 'string' && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value);
const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizePayload = (body) => {
  const fields = [
    'name',
    'enabled',
    'startDate',
    'endDate',
    'bannerText',
    'bannerCtaLabel',
    'bannerCtaUrl',
    'popupVersionA',
    'popupVersionB',
    'popupCtaLabel',
    'popupCtaUrl',
    'popupDelayMs',
    'popupCooldownMs',
    'termsLabel',
    'termsUrl',
    'disclaimer',
  ];
  const payload = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) payload[field] = body[field];
  }
  if (payload.startDate !== undefined) payload.startDate = new Date(payload.startDate);
  if (payload.endDate !== undefined) payload.endDate = new Date(payload.endDate);
  return payload;
};

const validateCampaign = (data) => {
  const requiredText = [
    'name',
    'bannerText',
    'bannerCtaLabel',
    'popupVersionA',
    'popupVersionB',
    'popupCtaLabel',
    'termsLabel',
    'disclaimer',
  ];
  if (requiredText.some((key) => typeof data[key] !== 'string' || !data[key].trim()))
    return 'Required campaign text is missing.';
  const maxLengths = {
    name: 120,
    bannerText: 1000,
    bannerCtaLabel: 80,
    popupVersionA: 500,
    popupVersionB: 500,
    popupCtaLabel: 80,
    termsLabel: 80,
    disclaimer: 10000,
  };
  if (Object.entries(maxLengths).some(([key, max]) => data[key].length > max))
    return 'Campaign text exceeds the allowed length.';
  if (typeof data.enabled !== 'boolean') return 'enabled must be a boolean.';
  if (
    !(data.startDate instanceof Date) ||
    Number.isNaN(data.startDate.getTime()) ||
    !(data.endDate instanceof Date) ||
    Number.isNaN(data.endDate.getTime()) ||
    data.startDate >= data.endDate
  )
    return 'Campaign dates are invalid.';
  if (
    !isLocalPath(data.bannerCtaUrl) ||
    !isLocalPath(data.popupCtaUrl) ||
    !isLocalPath(data.termsUrl)
  )
    return 'Campaign destinations must be local paths.';
  if (!Number.isInteger(data.popupDelayMs) || data.popupDelayMs < 0 || data.popupDelayMs > 30000)
    return 'Popup delay must be between 0 and 30000 ms.';
  if (
    !Number.isInteger(data.popupCooldownMs) ||
    data.popupCooldownMs < 60000 ||
    data.popupCooldownMs > 31536000000
  )
    return 'Popup cooldown must be between 1 minute and 365 days.';
  return null;
};

const conflictsWithEnabledCampaign = async (data, excludedId) => {
  if (!data.enabled) return false;
  const query = {
    enabled: true,
    startDate: { $lt: data.endDate },
    endDate: { $gt: data.startDate },
  };
  if (excludedId) query._id = { $ne: excludedId };
  return Boolean(await Campaign.exists(query));
};

const publicCampaign = (campaign, assignment) => ({
  campaign: {
    id: campaign._id.toString(),
    name: campaign.name,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    bannerText: campaign.bannerText,
    bannerCtaLabel: campaign.bannerCtaLabel,
    bannerCtaUrl: campaign.bannerCtaUrl,
    popupVersionA: campaign.popupVersionA,
    popupVersionB: campaign.popupVersionB,
    popupCtaLabel: campaign.popupCtaLabel,
    popupCtaUrl: campaign.popupCtaUrl,
    popupDelayMs: campaign.popupDelayMs,
    popupCooldownMs: campaign.popupCooldownMs,
    termsLabel: campaign.termsLabel,
    termsUrl: campaign.termsUrl,
  },
  assignment,
});

const adminCampaign = (campaign) => {
  const safeCampaign = campaign.toObject ? campaign.toObject() : { ...campaign };
  delete safeCampaign.assignmentSecret;
  return safeCampaign;
};

const signAssignment = (campaign, visitorId) => {
  const variant =
    crypto.createHmac('sha256', campaign.assignmentSecret).update(visitorId).digest()[0] < 128
      ? 'A'
      : 'B';
  const payload = Buffer.from(
    JSON.stringify({ campaignId: campaign._id.toString(), visitorId, variant })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', campaign.assignmentSecret)
    .update(payload)
    .digest('base64url');
  return { variant, token: `${payload}.${signature}` };
};

const verifyAssignment = (token, campaign) => {
  if (typeof token !== 'string' || token.length > 1000) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', campaign.assignmentSecret).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      claims.campaignId !== campaign._id.toString() ||
      !isUuid(claims.visitorId) ||
      !['A', 'B'].includes(claims.variant)
    )
      return null;
    return claims;
  } catch {
    return null;
  }
};

const isActive = (campaign, now = new Date()) =>
  campaign.enabled && campaign.startDate <= now && campaign.endDate >= now;

exports.getPublicCampaign = async (req, res) => {
  try {
    const visitorId = req.query.visitorId;
    if (!isUuid(visitorId))
      return res.status(400).json({ success: false, message: 'A valid visitor ID is required.' });
    await ensureDefaultCampaign();
    const now = new Date();
    const campaign = await Campaign.findOne({
      enabled: true,
      deletedAt: null,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).select('+assignmentSecret');
    if (!campaign || !isActive(campaign, now))
      return res.json({ success: true, data: { campaign: null } });
    const assignment = signAssignment(campaign, visitorId);
    return res.json({ success: true, data: publicCampaign(campaign, assignment) });
  } catch (error) {
    console.error('Public campaign config error', error);
    return res.status(500).json({ success: false, message: 'Could not load campaign.' });
  }
};

exports.getTerms = async (req, res) => {
  try {
    const campaign = await ensureDefaultCampaign();
    return res.json({
      success: true,
      data: { name: campaign.name, disclaimer: campaign.disclaimer },
    });
  } catch (error) {
    console.error('Campaign terms error', error);
    return res.status(500).json({ success: false, message: 'Could not load campaign terms.' });
  }
};

exports.trackEvent = async (req, res) => {
  try {
    const { eventId, eventType, closeMethod, assignmentToken } = req.body || {};
    if (!isUuid(eventId) || !['impression', 'click', 'close'].includes(eventType))
      return res.status(400).json({ success: false, message: 'Invalid campaign event.' });
    if (
      (eventType === 'close' && !['button', 'backdrop', 'escape'].includes(closeMethod)) ||
      (eventType !== 'close' && closeMethod !== undefined)
    )
      return res.status(400).json({ success: false, message: 'Invalid close method.' });
    if (typeof assignmentToken !== 'string' || assignmentToken.length > 1000)
      return res.status(400).json({ success: false, message: 'Invalid campaign assignment.' });
    const [encoded] = assignmentToken.split('.');
    let campaignId;
    try {
      campaignId = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')).campaignId;
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid campaign assignment.' });
    }
    if (!mongoose.isValidObjectId(campaignId))
      return res.status(400).json({ success: false, message: 'Invalid campaign assignment.' });
    const campaign = await Campaign.findById(campaignId).select('+assignmentSecret');
    const assignment =
      campaign && !campaign.deletedAt && verifyAssignment(assignmentToken, campaign);
    if (!assignment)
      return res.status(400).json({ success: false, message: 'Invalid campaign assignment.' });
    await CampaignEvent.create({
      eventId,
      campaignId: campaign._id,
      variant: assignment.variant,
      eventType,
      closeMethod: eventType === 'close' ? closeMethod : undefined,
    });
    return res.status(201).json({ success: true, data: { recorded: true } });
  } catch (error) {
    if (error.code === 11000)
      return res.json({ success: true, data: { recorded: false, duplicate: true } });
    console.error('Campaign event error', error);
    return res.status(500).json({ success: false, message: 'Could not record campaign event.' });
  }
};

exports.listCampaigns = async (req, res) => {
  try {
    await ensureDefaultCampaign();
    const campaigns = await Campaign.find({ deletedAt: null }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: { campaigns } });
  } catch (error) {
    console.error('Admin campaigns list error', error);
    return res.status(500).json({ success: false, message: 'Could not load campaigns.' });
  }
};

exports.getCampaignDefaults = async (req, res) => {
  const defaults = DEFAULTS();
  delete defaults.slug;
  return res.json({ success: true, data: { defaults } });
};

exports.createCampaign = async (req, res) => {
  try {
    const data = { ...DEFAULTS(), ...normalizePayload(req.body || {}) };
    delete data.slug;
    const error = validateCampaign(data);
    if (error) return res.status(400).json({ success: false, message: error });
    if (await conflictsWithEnabledCampaign(data))
      return res
        .status(409)
        .json({ success: false, message: 'Another enabled campaign overlaps these dates.' });
    const campaign = await Campaign.create({ ...data, slug: `campaign-${crypto.randomUUID()}` });
    return res.status(201).json({ success: true, data: { campaign: adminCampaign(campaign) } });
  } catch (error) {
    console.error('Admin campaign create error', error);
    if (error.name === 'ValidationError')
      return res.status(400).json({ success: false, message: 'Campaign settings are invalid.' });
    return res.status(500).json({ success: false, message: 'Could not create campaign.' });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid campaign ID.' });
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign || campaign.deletedAt)
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    const data = { ...campaign.toObject(), ...normalizePayload(req.body || {}) };
    const error = validateCampaign(data);
    if (error) return res.status(400).json({ success: false, message: error });
    if (await conflictsWithEnabledCampaign(data, campaign._id))
      return res
        .status(409)
        .json({ success: false, message: 'Another enabled campaign overlaps these dates.' });
    for (const [key, value] of Object.entries(normalizePayload(req.body || {})))
      campaign[key] = value;
    await campaign.save();
    return res.json({ success: true, data: { campaign: adminCampaign(campaign) } });
  } catch (error) {
    console.error('Admin campaign update error', error);
    if (error.name === 'ValidationError')
      return res.status(400).json({ success: false, message: 'Campaign settings are invalid.' });
    return res.status(500).json({ success: false, message: 'Could not update campaign.' });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid campaign ID.' });
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign || campaign.deletedAt)
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    campaign.enabled = false;
    campaign.deletedAt = new Date();
    await campaign.save();
    return res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Admin campaign delete error', error);
    return res.status(500).json({ success: false, message: 'Could not delete campaign.' });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid campaign ID.' });
    if (!(await Campaign.exists({ _id: req.params.id })))
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    const groups = await CampaignEvent.aggregate([
      { $match: { campaignId: new mongoose.Types.ObjectId(req.params.id) } },
      { $group: { _id: { variant: '$variant', eventType: '$eventType' }, count: { $sum: 1 } } },
    ]);
    const result = {
      total: { impressions: 0, clicks: 0, closes: 0, ctr: 0 },
      variants: {
        A: { impressions: 0, clicks: 0, closes: 0, ctr: 0 },
        B: { impressions: 0, clicks: 0, closes: 0, ctr: 0 },
      },
    };
    const fieldByType = { impression: 'impressions', click: 'clicks', close: 'closes' };
    for (const group of groups) {
      const field = fieldByType[group._id.eventType];
      result.variants[group._id.variant][field] = group.count;
      result.total[field] += group.count;
    }
    for (const stats of [result.total, result.variants.A, result.variants.B]) {
      stats.ctr = stats.impressions
        ? Number(((stats.clicks / stats.impressions) * 100).toFixed(2))
        : 0;
    }
    return res.json({ success: true, data: { analytics: result } });
  } catch (error) {
    console.error('Campaign analytics error', error);
    return res.status(500).json({ success: false, message: 'Could not load campaign analytics.' });
  }
};

exports.ensureDefaultCampaign = ensureDefaultCampaign;
