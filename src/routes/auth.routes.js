const { Router } = require('express');
const { z } = require('zod');
const authController = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signinSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/organization/signup', validate(signupSchema), authController.orgSignup);
router.post('/organization/signin', validate(signinSchema), authController.orgSignin);

router.post('/volunteer/signup', validate(signupSchema), authController.volSignup);
router.post('/volunteer/signin', validate(signinSchema), authController.volSignin);

router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
