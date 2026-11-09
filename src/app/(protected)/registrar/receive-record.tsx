"use client";

import { useActionState } from "react";
import { receiveRecord, type StudentActionState } from "../students/actions";

export function ReceiveRecordForm({ surrenderId }: { surrenderId: string }) {
  const [state, action, pending] = useActionState<StudentActionState, FormData>(receiveRecord, {});

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="surrenderId" value={surrenderId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-on-accent hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? "Receiving…" : "Receive record"}
      </button>
      {state.error && <span className="text-[11px] text-rose-600 dark:text-rose-300">{state.error}</span>}
    </form>
  );
}
