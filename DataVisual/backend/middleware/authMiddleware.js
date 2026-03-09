import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[Auth] FATAL: JWT_SECRET is not set in environment variables. Authentication will fail.');
}

const authMiddleware = (req, res, next) => {
    if (!JWT_SECRET) {
        return res.status(500).json({ message: 'Server misconfiguration: JWT_SECRET not set.' });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

export default authMiddleware;
