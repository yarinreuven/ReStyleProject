import Joi from "joi";

export const userIdParamsSchema = Joi.object({
  userId: Joi.string().hex().length(24).required().messages({
    "any.required": "Invalid user ID",
    "string.empty": "Invalid user ID",
    "string.hex": "Invalid user ID",
    "string.length": "Invalid user ID"
  })
});

export const registerSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "First name is required",
      "string.min": "First name must contain at least 2 characters",
      "string.max": "First name cannot contain more than 50 characters"
    }),

  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Last name is required",
      "string.min": "Last name must contain at least 2 characters",
      "string.max": "Last name cannot contain more than 50 characters"
    }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Please enter a valid email address"
    }),

  password: Joi.string()
    .min(6)
    .max(100)
    .required()
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must contain at least 6 characters",
      "string.max": "Password cannot contain more than 100 characters"
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref("password"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "string.empty": "Confirm password is required"
    }),

  language: Joi.string()
    .valid("en", "he")
    .default("en"),

  gender: Joi.string()
    .valid("female", "male")
    .required()
    .messages({
      "any.only": "Please select Female or Male",
      "any.required": "Gender is required",
      "string.empty": "Gender is required"
    }),

  termsAccepted: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .valid(true)
    .required()
    .messages({
      "any.only": "You must agree to the Terms of Service",
      "any.required": "You must agree to the Terms of Service"
    })
});

export const loginSchema = Joi.object({
  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .required()
    .messages({
      "string.empty": "Email is required",
      "string.email": "Please enter a valid email address"
    }),

  password: Joi.string()
    .required()
    .messages({
      "string.empty": "Password is required"
    })
});

export const googleAuthSchema = Joi.object({
  credential: Joi.string().min(100).required().messages({
    "string.empty": "Google credential is required",
    "string.min": "Google credential is invalid"
  }),
  intent: Joi.string().valid("login", "register").required(),
  termsAccepted: Joi.when("intent", {
    is: "register",
    then: Joi.boolean().valid(true).required().messages({
      "any.only": "You must agree to the Terms of Service",
      "any.required": "You must agree to the Terms of Service"
    }),
    otherwise: Joi.forbidden()
  })
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "First name is required",
      "string.min": "First name must contain at least 2 characters",
      "string.max": "First name cannot contain more than 50 characters"
    }),

  lastName: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      "string.empty": "Last name is required",
      "string.min": "Last name must contain at least 2 characters",
      "string.max": "Last name cannot contain more than 50 characters"
    }),
  gender: Joi.string().valid("female", "male", "unspecified").required().messages({
    "any.only": "Please select a valid gender",
    "any.required": "Gender is required"
  })
});

export const requestEmailChangeSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Please enter a valid email address"
  })
});

export const confirmEmailChangeSchema = Joi.object({
  code: Joi.string().pattern(/^\d{6}$/).required().messages({
    "string.empty": "Verification code is required",
    "string.pattern.base": "Enter the 6-digit verification code"
  })
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "string.empty": "Current password is required"
  }),
  newPassword: Joi.string().min(6).max(100).required().messages({
    "string.empty": "New password is required",
    "string.min": "New password must contain at least 6 characters",
    "string.max": "New password cannot contain more than 100 characters"
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "string.empty": "Please confirm your new password"
    })
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Please enter a valid email address"
  })
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().hex().length(64).required().messages({
    "string.empty": "Reset token is required",
    "string.hex": "Reset link is invalid",
    "string.length": "Reset link is invalid"
  }),
  newPassword: Joi.string().min(6).max(100).required().messages({
    "string.empty": "New password is required",
    "string.min": "New password must contain at least 6 characters",
    "string.max": "New password cannot contain more than 100 characters"
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "string.empty": "Please confirm your new password"
    })
});
