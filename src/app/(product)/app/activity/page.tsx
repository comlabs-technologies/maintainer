import { requireUserId } from "@/lib/auth/access";
import { getDb } from "@/db/client";
import { activityEvents, repositories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { dayLabel, formatClock } from "@/lib/utils/time";

export default async function ActivityPage() {
  const userId = await requireUserId();
  const db = getDb();
  const events = await db
    .select({
      event: activityEvents,
      repository: repositories,
    })
    .from(activityEvents)
    .leftJoin(repositories, eq(activityEvents.repositoryId, repositories.id))
    .where(eq(activityEvents.clerkUserId, userId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(100);

  const groups = new Map<string, typeof events>();
  for (const row of events) {
    const label = dayLabel(row.event.createdAt);
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }

  return (
    <div>
      <h1 className="text-[26px] font-medium tracking-[-0.03em]">Activity</h1>
      {events.length === 0 ? (
        <p className="mt-10 text-[14px] text-secondary">No activity yet.</p>
      ) : (
        <div className="mt-10 space-y-10">
          {[...groups.entries()].map(([label, rows]) => (
            <section key={label}>
              <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-muted">
                {label}
              </h2>
              <ol className="mt-4 space-y-5">
                {rows.map(({ event, repository }) => (
                  <li key={event.id} className="grid grid-cols-[52px_1fr] gap-4">
                    <span className="font-mono text-[13px] text-muted">
                      {formatClock(event.createdAt)}
                    </span>
                    <div>
                      <p className="text-[14px]">{event.title}</p>
                      {repository ? (
                        <p className="mt-0.5 text-[13px] text-secondary">
                          {repository.fullName}
                        </p>
                      ) : event.body ? (
                        <p className="mt-0.5 text-[13px] text-secondary">{event.body}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
