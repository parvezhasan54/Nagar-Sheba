-- CreateIndex
CREATE INDEX "service_requests_createdAt_idx" ON "service_requests"("createdAt");

-- CreateIndex
CREATE INDEX "service_requests_citizenId_createdAt_idx" ON "service_requests"("citizenId", "createdAt");

-- CreateIndex
CREATE INDEX "service_requests_departmentId_createdAt_idx" ON "service_requests"("departmentId", "createdAt");

-- CreateIndex
CREATE INDEX "service_requests_status_slaDueAt_idx" ON "service_requests"("status", "slaDueAt");
