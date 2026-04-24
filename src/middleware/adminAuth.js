export const adminAuth = (req, res, next) => {
  const adminToken = req.headers['x-admin-token'];
  const VALID_TOKEN = process.env.ADMIN_TOKEN;

  if (!adminToken || adminToken !== VALID_TOKEN) {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Unauthorized: Invalid admin token'
    });
  }

  next();
};
