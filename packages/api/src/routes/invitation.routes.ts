import { Router, Request, Response } from 'express';
import { MemberService } from '../services/member.service';
import { z } from 'zod';

const router = Router();

const acceptInvitationSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
  name: z.string().min(2),
});

router.post('/accept', async (req: Request, res: Response): Promise<void> => {
  try {
    const input = acceptInvitationSchema.parse(req.body);
    const result = await MemberService.acceptInvitation(
      input.token,
      input.password,
      input.name
    );
    
    res.json({
      success: true,
      data: result,
      message: 'Invitation accepted successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept invitation',
    });
  }
});

export default router;
