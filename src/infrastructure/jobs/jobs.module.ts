import { Module } from "@nestjs/common";
import { JobQueue } from "../../shared/domain/job-queue";
import { JobScheduler } from "../../shared/domain/job-scheduler";
import { GoogleJobQueue } from "./google-job-queue";
import { GoogleJobScheduler } from "./google-job-scheduler";
import { GoogleJobGuard } from "./google-job.guard";
/** Provides Google integrations without provisioning cloud resources on startup. */
@Module({
  providers: [
    GoogleJobGuard,
    { provide: JobQueue, useClass: GoogleJobQueue },
    { provide: JobScheduler, useClass: GoogleJobScheduler }
  ],
  exports: [JobQueue, JobScheduler, GoogleJobGuard]
})
export class JobsModule {}
