import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface AuthedRequest extends Request {
  personId?: string;
  personName?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (!token) {
    res.status(401).json({ error: 'Non autenticato' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { personId: string; name: string };
    req.personId = payload.personId;
    req.personName = payload.name;
    next();
  } catch {
    res.status(401).json({ error: 'Sessione non valida' });
  }
}
