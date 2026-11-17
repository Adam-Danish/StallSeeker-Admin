import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, limit, type QueryConstraint, type Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { decideCase, moderationError, reviewReport } from '../moderationApi';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

export const reasonLabels: Record<string, string> = {
  wrong_location: 'Wrong location', opening_status: 'Incorrect opening status or hours',
  menu_prices: 'Outdated menu, prices, or availability', stall_details: 'Incorrect stall information', other: 'Other inaccurate information',
};
interface Summary { reason: string; details: string; observedAt?: Timestamp }
interface ModerationEntry {
  id: string; vendorId: string; customerId?: string; stallName: string; status: string;
  reason?: string; details?: string; createdAt?: Timestamp; observedAt?: Timestamp; dueAt?: Timestamp;
  adminReason?: string; vendorResponse?: string; responseStatus?: string; summaries?: Summary[];
  snapshot?: {stallName?: string; openingHours?: string; isOpen?: boolean; latitude?: number; longitude?: number; description?: string;
    menu?: {name: string; price: number; status: string}[]; menuMayBeTruncated?: boolean};
}
type Decision = {record: ModerationEntry; action: 'verify' | 'reject' | 'suspend' | 'resolve' | 'rejectCorrection'};
export function formatModerationTime(time?: Timestamp) {
  return time ? time.toDate().toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short'}) + ' MYT' : '—';
}
const panel = {background: '#fff', border: '1px solid #e9e5dd', borderRadius: 16};

export function ReportsPage({vendorId, onClearVendor, onOpenVendor}: {vendorId?: string; onClearVendor: () => void; onOpenVendor: (vendorId: string) => void}) {
  const [reports, setReports] = useState<ModerationEntry[]>([]);
  const [cases, setCases] = useState<ModerationEntry[]>([]);
  const [filter, setFilter] = useState('pending');
  const [size, setSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [caseLoading, setCaseLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { setSize(50); }, [vendorId, filter]);
  useEffect(() => {
    setLoading(true); setCaseLoading(true); setReportError(null); setCaseError(null); setReports([]); setCases([]);
    const scope: QueryConstraint[] = vendorId ? [where('vendorId', '==', vendorId)] : [];
    const status = filter === 'all' ? [] : [where('status', '==', filter)];
    const stopReports = onSnapshot(query(collection(db, 'vendorReports'), ...scope, ...status, orderBy('createdAt', 'desc'), limit(size)),
      (snapshot) => { setReports(snapshot.docs.map((doc) => ({...doc.data(), id: doc.id} as ModerationEntry))); setLoading(false); },
      () => { setReportError('Could not load reports. Check your connection and deployed indexes.'); setLoading(false); });
    const stopCases = onSnapshot(query(collection(db, 'moderationCases'), ...scope, orderBy('createdAt', 'desc'), limit(size)),
      (snapshot) => { setCases(snapshot.docs.map((doc) => ({...doc.data(), id: doc.id} as ModerationEntry))); setCaseLoading(false); },
      () => { setCaseError('Could not load warning history. Check your connection and retry.'); setCaseLoading(false); });
    return () => { stopReports(); stopCases(); };
  }, [vendorId, filter, size, retry]);
  const begin = (record: ModerationEntry, action: Decision['action']) => { setDecision({record, action}); setReason(''); setSaveError(null); };
  const submit = async () => {
    if (!decision || saving || !reason.trim()) return;
    setSaving(true); setSaveError(null);
    try {
      const {record, action} = decision;
      if (action === 'verify' || action === 'reject') await reviewReport(record.id, action, reason.trim());
      else await decideCase(record.vendorId, record.id, action, reason.trim());
      setDecision(null); setNotice('Decision saved.');
    } catch (error) { setSaveError(moderationError(error)); }
    finally { setSaving(false); }
  };
  const sortedCases = [...cases].sort((a, b) => {
    const priority = (record: ModerationEntry) => record.status === 'suspended' ? 0
      : record.status === 'warning' && (record.dueAt?.toMillis() ?? Infinity) <= clock ? 1
      : record.status === 'warning' ? 2 : 3;
    return priority(a) - priority(b) || (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);
  });
  return <div className="space-y-6 p-4 sm:p-6 lg:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Reports & vendor warnings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Three different customers’ verified reports within 30 days trigger a warning. Vendors have 48 hours to correct information.</p></div>
      {vendorId && <Button variant="outline" onClick={onClearVendor}>Show all vendors</Button>}
    </div>
    {vendorId && <p className="break-all text-sm">Showing vendor: {vendorId}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">{notice}</p>}
    {(reportError || caseError) && <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">
      {reportError} {caseError} <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>Retry</Button></div>}
    <section aria-labelledby="warnings-title" style={panel} className="p-4 sm:p-6">
      <h3 id="warnings-title" className="mb-4 text-lg font-semibold">Warnings & correction reviews</h3>
      {caseLoading ? <p role="status">Loading warnings…</p> : !caseError && cases.length === 0 ? <p>No warning cases.</p> : null}
      <div className="space-y-4">{sortedCases.map((record) => {
        const overdue = record.status === 'warning' && (record.dueAt?.toMillis() ?? Infinity) <= clock;
        const active = record.status === 'warning' || record.status === 'suspended';
        return <article key={record.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><h4 className="font-semibold">{record.stallName}</h4>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm text-orange-900">{overdue ? 'Overdue' : record.status}</span></div>
          <p className="mt-2 text-sm">Issued: {formatModerationTime(record.createdAt)} · Deadline: {formatModerationTime(record.dueAt)}</p>
          <ul className="my-3 list-disc space-y-2 pl-5">{record.summaries?.map((summary, index) => <li key={index}>
            <strong>{reasonLabels[summary.reason] || summary.reason}:</strong> {summary.details}
            <span className="block text-sm text-muted-foreground">Observed: {formatModerationTime(summary.observedAt)}</span></li>)}</ul>
          {record.vendorResponse && <div className="my-3 rounded-lg bg-slate-50 p-3"><p className="font-medium">Vendor response ({record.responseStatus})</p>
            <p className="whitespace-pre-wrap break-words">{record.vendorResponse}</p></div>}
          {record.adminReason && <p className="my-2 whitespace-pre-wrap break-words text-sm">Admin: {record.adminReason}</p>}
          <Button className="my-2" variant="outline" onClick={() => onOpenVendor(record.vendorId)}>View current listing</Button>
          {active && <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => begin(record, 'resolve')}>Approve correction / resolve</Button>
            {record.responseStatus === 'pending' && <Button variant="outline" onClick={() => begin(record, 'rejectCorrection')}>Request further correction</Button>}
            {overdue && <Button variant="destructive" onClick={() => begin(record, 'suspend')}>Suspend listing</Button>}
          </div>}
        </article>;
      })}</div>
    </section>
    <section aria-labelledby="reports-title" style={panel} className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 id="reports-title" className="text-lg font-semibold">Customer reports</h3>
        <label className="flex items-center gap-2 text-sm">Status <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-md border bg-background p-2">
          {['pending', 'verified', 'rejected', 'resolved', 'all'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select></label></div>
      {loading ? <p role="status">Loading reports…</p> : !reportError && reports.length === 0 ? <p>No reports with this status.</p> : null}
      <div className="space-y-4">{reports.map((record) => <article key={record.id} className="rounded-xl border p-4">
        <h4 className="font-semibold">{record.stallName} · {record.status}</h4>
        <p className="mt-1 break-all text-xs text-muted-foreground">Customer: {record.customerId} · Vendor: {record.vendorId}</p>
        <p className="mt-2 font-medium">{reasonLabels[record.reason || ''] || record.reason}</p>
        <p className="whitespace-pre-wrap break-words">{record.details}</p>
        <p className="mt-2 text-sm">Observed: {formatModerationTime(record.observedAt)} · Submitted: {formatModerationTime(record.createdAt)}</p>
        <details className="my-3"><summary className="cursor-pointer text-sm font-medium">Listing at submission</summary>
          <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
            <p>{record.snapshot?.stallName} · {record.snapshot?.isOpen ? 'Open' : 'Closed'}</p>
            <p>Hours: {record.snapshot?.openingHours || 'Not set'}</p>
            <p>Location: {record.snapshot?.latitude}, {record.snapshot?.longitude}</p>
            <p className="whitespace-pre-wrap break-words">{record.snapshot?.description}</p>
            {record.snapshot?.menu?.map((item, index) => <p key={index}>{item.name} · RM {item.price.toFixed(2)} · {item.status}</p>)}
            {record.snapshot?.menuMayBeTruncated && <p>Snapshot contains the first 100 menu items.</p>}
          </div></details>
        {record.adminReason && <p className="my-2 text-sm">Admin: {record.adminReason}</p>}
        <Button className="my-2" variant="outline" onClick={() => onOpenVendor(record.vendorId)}>View current listing</Button>
        {record.status === 'pending' && <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => begin(record, 'verify')}>Verify report</Button>
          <Button variant="outline" onClick={() => begin(record, 'reject')}>Reject report</Button>
        </div>}
      </article>)}</div>
    </section>
    {(reports.length >= size || cases.length >= size) && <Button variant="outline" disabled={loading || caseLoading} onClick={() => setSize((value) => value + 50)}>Load older records</Button>}
    <Dialog open={decision !== null} onOpenChange={(open) => { if (!open && !saving) setDecision(null); }}>
      <DialogContent><DialogHeader><DialogTitle>{decision?.action === 'verify' ? 'Verify this report?' : decision?.action === 'reject' ? 'Reject this report?'
        : decision?.action === 'suspend' ? 'Suspend this listing?' : decision?.action === 'resolve' ? 'Approve and resolve this case?' : 'Request further correction?'}</DialogTitle>
        <DialogDescription>{decision?.action === 'suspend' ? 'The listing will be hidden and new bookings blocked. Existing orders remain accessible.'
          : decision?.action === 'resolve' ? 'Check the current listing against the reported issue first. Approval restores visibility and leaves the stall closed.'
            : 'Record the evidence checked and the reason for your decision. This decision is saved in the activity log.'}</DialogDescription></DialogHeader>
        <label htmlFor="moderation-reason" className="text-sm font-medium">Admin reason</label>
        <Textarea id="moderation-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={4} disabled={saving} />
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDecision(null)}>Cancel</Button>
          <Button disabled={saving || !reason.trim()} onClick={() => void submit()}>{saving ? 'Saving…' : 'Confirm decision'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
