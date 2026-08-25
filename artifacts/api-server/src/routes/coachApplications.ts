import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { logger } from "../lib/logger";

const router = Router();

// ─── GET /coach-applications/my ──────────────────────────────────────────────

router.get("/coach-applications/my", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;

  try {
    const result = await db.execute(sql`
      SELECT * FROM coach_applications WHERE user_id = ${userId}
      ORDER BY created_at DESC LIMIT 1
    `);
    const app = result.rows[0] as any;
    if (!app) {
      res.json({ application: null });
      return;
    }
    res.json({ application: formatApplication(app) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Get coach application error");
    res.status(500).json({ error: "Failed to load application" });
  }
});

// ─── POST /coach-applications ────────────────────────────────────────────────
// Creates or fully replaces the applicant's application.

router.post("/coach-applications", requireAuth, async (req: AuthRequest, res) => {
  const { userId, accountType } = req.authUser!;

  if (!["coach_applicant", "coach"].includes(accountType)) {
    res.status(403).json({ error: "Only coach applicants can submit applications" });
    return;
  }

  const {
    fullName, phone, professionalTitle, biography,
    experienceYears, certifications, specialties, services,
    sessionLengths, prices, weeklyAvailability,
    virtualSessions, inPersonSessions, serviceLocation,
    professionalLinks, profilePhotoUrl, resumeUrl,
    agreedToTerms, status = "Submitted",
  } = req.body as any;

  if (!agreedToTerms) {
    res.status(400).json({ error: "You must agree to the Coach terms and policies" });
    return;
  }

  try {
    // Check if application exists already
    const existing = await db.execute(
      sql`SELECT id FROM coach_applications WHERE user_id = ${userId}`
    );

    let result;
    if ((existing.rows as any[]).length > 0) {
      // Update existing
      const appId = (existing.rows[0] as any).id;
      result = await db.execute(sql`
        UPDATE coach_applications SET
          full_name           = COALESCE(${fullName ?? null}, full_name),
          phone               = COALESCE(${phone ?? null}, phone),
          professional_title  = COALESCE(${professionalTitle ?? null}, professional_title),
          biography           = COALESCE(${biography ?? null}, biography),
          experience_years    = COALESCE(${experienceYears ?? null}::integer, experience_years),
          certifications      = COALESCE(${certifications ?? null}, certifications),
          specialties         = COALESCE(${specialties ? JSON.stringify(specialties) : null}, specialties),
          services            = COALESCE(${services ? JSON.stringify(services) : null}, services),
          session_lengths     = COALESCE(${sessionLengths ? JSON.stringify(sessionLengths) : null}, session_lengths),
          prices              = COALESCE(${prices ? JSON.stringify(prices) : null}, prices),
          weekly_availability = COALESCE(${weeklyAvailability ? JSON.stringify(weeklyAvailability) : null}, weekly_availability),
          virtual_sessions    = COALESCE(${virtualSessions !== undefined ? virtualSessions : null}::boolean, virtual_sessions),
          in_person_sessions  = COALESCE(${inPersonSessions !== undefined ? inPersonSessions : null}::boolean, in_person_sessions),
          service_location    = COALESCE(${serviceLocation ?? null}, service_location),
          professional_links  = COALESCE(${professionalLinks ? JSON.stringify(professionalLinks) : null}, professional_links),
          profile_photo_url   = COALESCE(${profilePhotoUrl ?? null}, profile_photo_url),
          resume_url          = COALESCE(${resumeUrl ?? null}, resume_url),
          agreed_to_terms     = ${Boolean(agreedToTerms)},
          status              = ${status},
          submitted_at        = NOW(),
          updated_at          = NOW()
        WHERE id = ${appId}
        RETURNING *
      `);
    } else {
      // Insert new
      result = await db.execute(sql`
        INSERT INTO coach_applications (
          user_id, full_name, phone, professional_title, biography,
          experience_years, certifications, specialties, services,
          session_lengths, prices, weekly_availability,
          virtual_sessions, in_person_sessions, service_location,
          professional_links, profile_photo_url, resume_url,
          agreed_to_terms, status, submitted_at
        ) VALUES (
          ${userId},
          ${fullName ?? null}, ${phone ?? null}, ${professionalTitle ?? null}, ${biography ?? null},
          ${experienceYears ?? null}::integer, ${certifications ?? null},
          ${specialties ? JSON.stringify(specialties) : null},
          ${services ? JSON.stringify(services) : null},
          ${sessionLengths ? JSON.stringify(sessionLengths) : null},
          ${prices ? JSON.stringify(prices) : null},
          ${weeklyAvailability ? JSON.stringify(weeklyAvailability) : null},
          ${Boolean(virtualSessions)}, ${Boolean(inPersonSessions)},
          ${serviceLocation ?? null},
          ${professionalLinks ? JSON.stringify(professionalLinks) : null},
          ${profilePhotoUrl ?? null}, ${resumeUrl ?? null},
          ${Boolean(agreedToTerms)}, ${status}, NOW()
        )
        RETURNING *
      `);
    }

    const app = result.rows[0] as any;
    res.status(201).json({ application: formatApplication(app) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Submit coach application error");
    res.status(500).json({ error: "Failed to submit application" });
  }
});

// ─── PATCH /coach-applications/my ────────────────────────────────────────────
// Save progress (status = "Incomplete")

router.patch("/coach-applications/my", requireAuth, async (req: AuthRequest, res) => {
  const { userId } = req.authUser!;
  const body = req.body as any;

  try {
    const existing = await db.execute(
      sql`SELECT id FROM coach_applications WHERE user_id = ${userId}`
    );

    if ((existing.rows as any[]).length === 0) {
      // Create a new incomplete draft
      await db.execute(sql`
        INSERT INTO coach_applications (user_id, status)
        VALUES (${userId}, 'Incomplete')
      `);
    }

    const fields: Record<string, any> = {
      full_name: body.fullName,
      phone: body.phone,
      professional_title: body.professionalTitle,
      biography: body.biography,
      experience_years: body.experienceYears,
      certifications: body.certifications,
      specialties: body.specialties ? JSON.stringify(body.specialties) : undefined,
      services: body.services ? JSON.stringify(body.services) : undefined,
      session_lengths: body.sessionLengths ? JSON.stringify(body.sessionLengths) : undefined,
      prices: body.prices ? JSON.stringify(body.prices) : undefined,
      weekly_availability: body.weeklyAvailability ? JSON.stringify(body.weeklyAvailability) : undefined,
      virtual_sessions: body.virtualSessions,
      in_person_sessions: body.inPersonSessions,
      service_location: body.serviceLocation,
      professional_links: body.professionalLinks ? JSON.stringify(body.professionalLinks) : undefined,
      profile_photo_url: body.profilePhotoUrl,
      resume_url: body.resumeUrl,
    };

    const result = await db.execute(sql`
      UPDATE coach_applications SET
        full_name           = COALESCE(${fields.full_name ?? null}, full_name),
        phone               = COALESCE(${fields.phone ?? null}, phone),
        professional_title  = COALESCE(${fields.professional_title ?? null}, professional_title),
        biography           = COALESCE(${fields.biography ?? null}, biography),
        experience_years    = COALESCE(${fields.experience_years ?? null}::integer, experience_years),
        certifications      = COALESCE(${fields.certifications ?? null}, certifications),
        specialties         = COALESCE(${fields.specialties ?? null}, specialties),
        services            = COALESCE(${fields.services ?? null}, services),
        session_lengths     = COALESCE(${fields.session_lengths ?? null}, session_lengths),
        prices              = COALESCE(${fields.prices ?? null}, prices),
        weekly_availability = COALESCE(${fields.weekly_availability ?? null}, weekly_availability),
        virtual_sessions    = COALESCE(${fields.virtual_sessions !== undefined ? fields.virtual_sessions : null}::boolean, virtual_sessions),
        in_person_sessions  = COALESCE(${fields.in_person_sessions !== undefined ? fields.in_person_sessions : null}::boolean, in_person_sessions),
        service_location    = COALESCE(${fields.service_location ?? null}, service_location),
        professional_links  = COALESCE(${fields.professional_links ?? null}, professional_links),
        profile_photo_url   = COALESCE(${fields.profile_photo_url ?? null}, profile_photo_url),
        resume_url          = COALESCE(${fields.resume_url ?? null}, resume_url),
        updated_at          = NOW()
      WHERE user_id = ${userId}
      RETURNING *
    `);

    const app = result.rows[0] as any;
    res.json({ application: formatApplication(app) });
  } catch (err: any) {
    logger.error({ err: err.message }, "Save draft application error");
    res.status(500).json({ error: "Failed to save application" });
  }
});

function formatApplication(app: any) {
  return {
    id: String(app.id),
    userId: String(app.user_id),
    fullName: app.full_name,
    phone: app.phone,
    professionalTitle: app.professional_title,
    biography: app.biography,
    experienceYears: app.experience_years,
    certifications: app.certifications,
    specialties: app.specialties ? JSON.parse(app.specialties) : [],
    services: app.services ? JSON.parse(app.services) : [],
    sessionLengths: app.session_lengths ? JSON.parse(app.session_lengths) : [],
    prices: app.prices ? JSON.parse(app.prices) : {},
    weeklyAvailability: app.weekly_availability ? JSON.parse(app.weekly_availability) : {},
    virtualSessions: Boolean(app.virtual_sessions),
    inPersonSessions: Boolean(app.in_person_sessions),
    serviceLocation: app.service_location,
    professionalLinks: app.professional_links ? JSON.parse(app.professional_links) : {},
    profilePhotoUrl: app.profile_photo_url,
    resumeUrl: app.resume_url,
    agreedToTerms: Boolean(app.agreed_to_terms),
    status: app.status,
    adminNotes: app.admin_notes,
    submittedAt: app.submitted_at,
    createdAt: app.created_at,
  };
}

export default router;
