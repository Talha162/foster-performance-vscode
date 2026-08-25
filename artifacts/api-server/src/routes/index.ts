import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bookingsRouter from "./bookings";
import subscriptionsRouter from "./subscriptions";
import authRouter from "./auth";
import coachApplicationsRouter from "./coachApplications";
import adminRouter from "./admin";
import coachesRouter from "./coaches";
import coachProgramsRouter from "./coachPrograms";
import coachSubscriptionsRouter from "./coachSubscriptions";
import coachAvailabilityRouter from "./coachAvailability";
import messagingRouter from "./messaging";
import nutritionRouter from "./nutrition";
import leaderboardRouter from "./leaderboard";

const router: IRouter = Router();

router.use(nutritionRouter);
router.use(leaderboardRouter);
router.use(messagingRouter);
router.use(authRouter);
router.use(coachApplicationsRouter);
router.use(adminRouter);
router.use(coachesRouter);
router.use(healthRouter);
router.use(bookingsRouter);
router.use(subscriptionsRouter);
router.use(coachProgramsRouter);
router.use(coachSubscriptionsRouter);
router.use(coachAvailabilityRouter);

export default router;
