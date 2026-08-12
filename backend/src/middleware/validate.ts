import type {
    NextFunction,
    Request,
    Response
  } from "express";
  
  import type { ObjectSchema } from "joi";
  
  export function validate(schema: ObjectSchema) {
    return (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      const { error, value } = schema.validate(
        req.body,
        {
          abortEarly: false,
          stripUnknown: true
        }
      );
  
      if (error) {
        const errors = error.details.map(
          (detail) => detail.message
        );
  
        return res.status(400).json({
          success: false,
          message: errors[0],
          errors
        });
      }
  
      req.body = value;
  
      next();
    };
  }