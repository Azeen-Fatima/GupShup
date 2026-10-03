import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny, ZodError } from 'zod';

export interface RequestValidators {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(
  schemaOrValidators: ZodTypeAny | RequestValidators,
  target: 'body' | 'query' | 'params' = 'body'
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if schemaOrValidators has body/query/params object shape
      const isValidatorsObject =
        typeof schemaOrValidators === 'object' &&
        schemaOrValidators !== null &&
        ('body' in schemaOrValidators || 'query' in schemaOrValidators || 'params' in schemaOrValidators);

      if (isValidatorsObject) {
        const validators = schemaOrValidators as RequestValidators;
        if (validators.body) {
          req.body = await validators.body.parseAsync(req.body);
        }
        if (validators.query) {
          req.query = await validators.query.parseAsync(req.query);
        }
        if (validators.params) {
          req.params = await validators.params.parseAsync(req.params);
        }
      } else {
        const schema = schemaOrValidators as ZodTypeAny;
        if (target === 'body') {
          req.body = await schema.parseAsync(req.body);
        } else if (target === 'query') {
          req.query = await schema.parseAsync(req.query);
        } else if (target === 'params') {
          req.params = await schema.parseAsync(req.params);
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
      } else {
        next(error);
      }
    }
  };
}
