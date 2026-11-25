import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Bell, BriefcaseBusiness, Check, CheckCheck, CircleHelp, ClipboardCheck, FileCheck2, FileText, Flower2, LayoutDashboard, LogOut, MapPin, Search, ShieldCheck, Sparkles, UserRound, Users, X, } from 'lucide-react';
import { formatFileSize, formatStatus, splitList } from '../lib/format';
import { tw } from '../lib/tw';
const emptyPriest = {
    experience_years: '',
    religious_education: '',
    qualifications: '',
    expertise: '',
    languages: '',
    preferred_locations: '',
    availability: '',
    expected_honorarium: '',
    public_listing: false,
};
const emptyTemple = {
    temple_name: '',
    legal_structure: 'RELIGIOUS_INSTITUTION',
    registration_number: '',
    address: '',
    city: '',
    state: '',
    contact_phone: '',
    management_details: '',
    public_listing: false,
};
const emptyOpportunity = { title: '', description: '', location: '', compensation: '' };
const priestCategories = ['CONTACT_INFORMATION', 'PROFESSIONAL_PROFILE', 'QUALIFICATIONS', 'EXPERIENCE'];
const templeCategories = ['TEMPLE_INFORMATION', 'MANAGEMENT_REPRESENTATIVE', 'LEGAL_STRUCTURE', 'REGISTRATION'];
function StatusBadge({ status }) {
    const tone = status === 'VERIFIED' || status === 'ACTIVE' || status === 'PUBLISHED'
        ? 'green'
        : status === 'REJECTED' || status === 'SUSPENDED' || status === 'CLOSED'
            ? 'red'
            : status === 'CORRECTION_REQUIRED'
                ? 'amber'
                : status === 'NOT_SUBMITTED'
                    ? 'neutral'
                    : 'blue';
    return <span className={tw(`status-badge ${tone} inline-flex items-center gap-1`)}><span />{formatStatus(status)}</span>;
}
function EmptyState({ icon: Icon, title, detail }) {
    return <div className={tw("empty-state")}><span className={tw("empty-icon")}><Icon size={20}/></span><strong>{title}</strong><p>{detail}</p></div>;
}
function StatCard({ label, value, note, icon: Icon, tone }) {
    return <article className={tw("stat-card")}><span className={tw(`stat-icon ${tone}`)}><Icon size={19}/></span><div className={tw("stat-label")}>{label}</div><div className={tw("stat-value")}>{value}</div><div className={tw("stat-note")}>{note}</div></article>;
}
export function Dashboard({ client, userId, onSignOut }) {
    const [profile, setProfile] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [verifications, setVerifications] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [priestForm, setPriestForm] = useState(emptyPriest);
    const [templeForm, setTempleForm] = useState(emptyTemple);
    const [profileName, setProfileName] = useState('');
    const [opportunities, setOpportunities] = useState([]);
    const [publicOpportunities, setPublicOpportunities] = useState([]);
    const [applications, setApplications] = useState([]);
    const [templeApplications, setTempleApplications] = useState([]);
    const [adminProfiles, setAdminProfiles] = useState([]);
    const [adminDocuments, setAdminDocuments] = useState([]);
    const [adminVerifications, setAdminVerifications] = useState([]);
    const [auditHistory, setAuditHistory] = useState([]);
    const [selectedAdminProfile, setSelectedAdminProfile] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [documentPreview, setDocumentPreview] = useState('');
    const previewRequest = useRef(0);
    const [documentStatus, setDocumentStatus] = useState('VERIFIED');
    const [reviewStatus, setReviewStatus] = useState('UNDER_REVIEW');
    const [reviewRemarks, setReviewRemarks] = useState('');
    const [verificationBasis, setVerificationBasis] = useState('');
    const [opportunityForm, setOpportunityForm] = useState(emptyOpportunity);
    const [activeTab, setActiveTab] = useState('overview');
    const [search, setSearch] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [submittedAfter, setSubmittedAfter] = useState('');
    const [submittedBefore, setSubmittedBefore] = useState('');
    const [submissionDates, setSubmissionDates] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const isAdmin = profile?.role === 'ADMIN';
    const isPriest = profile?.role === 'PRIEST';
    const isTemple = profile?.role === 'TEMPLE_MANAGEMENT';
    const loadAccount = useCallback(async () => {
        const { data: account, error: accountError } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (accountError) {
            setError(accountError.message);
            setLoading(false);
            return;
        }
        if (!account) {
            setError('Your account profile is not available. Please contact support before creating another account.');
            setLoading(false);
            return;
        }
        setError('');
        setProfile(account);
        setProfileName(account.full_name);
        setContactPhone(account.phone ?? '');
        if (account.role === 'PRIEST') {
            const { data, error: detailError } = await client.from('priests').select('*').eq('profile_id', userId).maybeSingle();
            if (detailError)
                setError(detailError.message);
            if (data)
                setPriestForm({
                    experience_years: data.experience_years === null ? '' : String(data.experience_years),
                    religious_education: data.religious_education ?? '',
                    qualifications: data.qualifications ?? '',
                    expertise: data.expertise.join(', '),
                    languages: data.languages.join(', '),
                    preferred_locations: data.preferred_locations.join(', '),
                    availability: data.availability ?? '',
                    expected_honorarium: data.expected_honorarium === null ? '' : String(data.expected_honorarium),
                    public_listing: data.public_listing,
                });
        }
        if (account.role === 'TEMPLE_MANAGEMENT') {
            const { data, error: detailError } = await client.from('temples').select('*').eq('profile_id', userId).maybeSingle();
            if (detailError)
                setError(detailError.message);
            if (data)
                setTempleForm({
                    temple_name: data.temple_name,
                    legal_structure: data.legal_structure,
                    registration_number: data.registration_number ?? '',
                    address: data.address ?? '',
                    city: data.city ?? '',
                    state: data.state ?? '',
                    contact_phone: data.contact_phone ?? '',
                    management_details: data.management_details ?? '',
                    public_listing: data.public_listing,
                });
        }
        const [documentResult, verificationResult, notificationResult] = await Promise.all([
            client.from('documents').select('*').eq('owner_id', userId).order('uploaded_at', { ascending: false }),
            client.from('verifications').select('*').eq('owner_id', userId).order('verification_category'),
            client.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
        ]);
        if (documentResult.error)
            setError(documentResult.error.message);
        if (verificationResult.error)
            setError(verificationResult.error.message);
        if (notificationResult.error)
            setError(notificationResult.error.message);
        setDocuments(documentResult.data ?? []);
        setVerifications(verificationResult.data ?? []);
        setNotifications(notificationResult.data ?? []);
        if (account.role === 'PRIEST') {
            const [opportunityResult, applicationResult] = await Promise.all([
                client.from('public_opportunities').select('*').order('published_at', { ascending: false }),
                client.from('applications').select('*').eq('priest_id', userId).order('created_at', { ascending: false }),
            ]);
            if (opportunityResult.error)
                setError(opportunityResult.error.message);
            if (applicationResult.error)
                setError(applicationResult.error.message);
            setPublicOpportunities(opportunityResult.data ?? []);
            setApplications(applicationResult.data ?? []);
        }
        else if (account.role === 'TEMPLE_MANAGEMENT') {
            const { data, error: opportunityError } = await client.from('opportunities').select('*').eq('temple_id', userId).order('created_at', { ascending: false });
            if (opportunityError)
                setError(opportunityError.message);
            const ownOpportunities = data ?? [];
            setOpportunities(ownOpportunities);
            if (ownOpportunities.length) {
                const { data: applicationData, error: applicationError } = await client.from('temple_application_applicants').select('*')
                    .in('opportunity_id', ownOpportunities.map((item) => item.id)).order('created_at', { ascending: false });
                if (applicationError)
                    setError(applicationError.message);
                setTempleApplications(applicationData ?? []);
            }
            else {
                setTempleApplications([]);
            }
        }
        else if (account.role === 'ADMIN') {
            const [profilesResult, docsResult, submissionsResult] = await Promise.all([
                client.from('profiles').select('*').neq('role', 'ADMIN').order('created_at', { ascending: false }),
                client.from('documents').select('*').order('uploaded_at', { ascending: false }),
                client.from('verifications').select('owner_id, submitted_at'),
            ]);
            if (profilesResult.error)
                setError(profilesResult.error.message);
            if (docsResult.error)
                setError(docsResult.error.message);
            if (submissionsResult.error)
                setError(submissionsResult.error.message);
            setAdminProfiles(profilesResult.data ?? []);
            setAdminDocuments(docsResult.data ?? []);
            const dates = (submissionsResult.data ?? []).reduce((result, item) => {
                if (item.submitted_at && (!result[item.owner_id] || item.submitted_at > result[item.owner_id])) {
                    result[item.owner_id] = item.submitted_at;
                }
                return result;
            }, {});
            setSubmissionDates(dates);
        }
        setLoading(false);
    }, [client, userId]);
    useEffect(() => {
        void Promise.resolve().then(loadAccount);
    }, [loadAccount]);
    const loadAdminReview = useCallback(async (selected) => {
        previewRequest.current += 1;
        setSelectedAdminProfile(selected);
        setSelectedDocument(null);
        setDocumentPreview('');
        setReviewRemarks('');
        setVerificationBasis('');
        const [verificationResult, documentResult] = await Promise.all([
            client.from('verifications').select('*').eq('owner_id', selected.id).order('verification_category'),
            client.from('documents').select('*').eq('owner_id', selected.id).order('uploaded_at', { ascending: false }),
        ]);
        if (verificationResult.error)
            setError(verificationResult.error.message);
        if (documentResult.error)
            setError(documentResult.error.message);
        const entries = verificationResult.data ?? [];
        const ownerDocuments = documentResult.data ?? [];
        const auditEntityIds = [selected.id, ...entries.map((item) => item.id), ...ownerDocuments.map((item) => item.id)];
        const { data: auditData, error: auditError } = await client.from('audit_logs').select('*')
            .in('entity_id', auditEntityIds).order('created_at', { ascending: false }).limit(50);
        if (auditError)
            setError(auditError.message);
        setAuditHistory(auditData ?? []);
        setAdminVerifications(entries);
        setAdminDocuments((current) => [
            ...current.filter((item) => item.owner_id !== selected.id),
            ...ownerDocuments,
        ]);
        setSelectedCategory(entries[0]?.verification_category ?? '');
        setActiveTab('review');
    }, [client]);
    const visibleProfiles = useMemo(() => adminProfiles.filter((item) => {
        const matchesText = `${item.full_name} ${item.email ?? ''} ${item.phone ?? ''}`.toLowerCase().includes(search.toLowerCase());
        return matchesText
            && (roleFilter === 'ALL' || item.role === roleFilter)
            && (statusFilter === 'ALL' || item.verification_status === statusFilter)
            && (!submittedAfter || Boolean(submissionDates[item.id] && submissionDates[item.id].slice(0, 10) >= submittedAfter))
            && (!submittedBefore || Boolean(submissionDates[item.id] && submissionDates[item.id].slice(0, 10) <= submittedBefore));
    }), [adminProfiles, roleFilter, search, statusFilter, submittedAfter, submittedBefore, submissionDates]);
    const pendingVerificationCount = adminProfiles.filter((item) => ['PENDING', 'UNDER_REVIEW', 'CORRECTION_REQUIRED'].includes(item.verification_status)).length;
    const pendingDocumentCount = adminDocuments.filter((item) => item.verification_status === 'PENDING').length;
    const priestCount = adminProfiles.filter((item) => item.role === 'PRIEST').length;
    const templeCount = adminProfiles.filter((item) => item.role === 'TEMPLE_MANAGEMENT').length;
    const profilesWithoutDocuments = adminProfiles.filter((item) => !adminDocuments.some((document) => document.owner_id === item.id)).length;
    const saveProfile = async (event) => {
        event.preventDefault();
        if (!profile)
            return;
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const nextName = profileName.trim();
            const nextPhone = contactPhone.trim();
            if (nextName.length < 2 || nextName.length > 120)
                throw new Error('Your full name must be between 2 and 120 characters.');
            if (nextPhone && !/^\+[1-9]\d{7,14}$/.test(nextPhone))
                throw new Error('Enter your contact number in international format, for example +919876543210.');
            const { error: nameError } = await client.from('profiles').update({
                full_name: nextName,
                phone: nextPhone || null,
            }).eq('id', userId);
            if (nameError)
                throw nameError;
            if (isPriest) {
                const experience = priestForm.experience_years.trim() ? Number(priestForm.experience_years) : null;
                const honorarium = priestForm.expected_honorarium.trim() ? Number(priestForm.expected_honorarium) : null;
                if (experience !== null && (!Number.isInteger(experience) || experience < 0 || experience > 80))
                    throw new Error('Experience must be a whole number from 0 to 80.');
                if (honorarium !== null && (!Number.isFinite(honorarium) || honorarium < 0))
                    throw new Error('Expected honorarium must be a non-negative amount.');
                const { error: priestError } = await client.from('priests').upsert({
                    profile_id: userId,
                    experience_years: experience,
                    religious_education: priestForm.religious_education.trim() || null,
                    qualifications: priestForm.qualifications.trim() || null,
                    expertise: splitList(priestForm.expertise),
                    languages: splitList(priestForm.languages),
                    preferred_locations: splitList(priestForm.preferred_locations),
                    availability: priestForm.availability.trim() || null,
                    expected_honorarium: honorarium,
                    public_listing: priestForm.public_listing,
                }, { onConflict: 'profile_id' });
                if (priestError)
                    throw priestError;
            }
            else if (isTemple) {
                if (templeForm.temple_name.trim().length < 2)
                    throw new Error('Enter the temple or organisation name.');
                const { error: templeError } = await client.from('temples').upsert({
                    profile_id: userId,
                    temple_name: templeForm.temple_name.trim(),
                    legal_structure: templeForm.legal_structure,
                    registration_number: templeForm.registration_number.trim() || null,
                    address: templeForm.address.trim() || null,
                    city: templeForm.city.trim() || null,
                    state: templeForm.state.trim() || null,
                    contact_phone: templeForm.contact_phone.trim() || null,
                    management_details: templeForm.management_details.trim() || null,
                    public_listing: templeForm.public_listing,
                }, { onConflict: 'profile_id' });
                if (templeError)
                    throw templeError;
            }
            setNotice('Your profile has been saved.');
            await loadAccount();
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Your profile could not be saved.');
        }
        finally {
            setSaving(false);
        }
    };
    const submitForReview = async () => {
        setSaving(true);
        setError('');
        setNotice('');
        const { error: submitError } = await client.rpc('submit_verification');
        if (submitError) {
            setError(submitError.message);
        }
        else {
            setNotice('Your profile has been submitted for manual review. Documents are optional.');
            await loadAccount();
        }
        setSaving(false);
    };
    const uploadDocument = async (file, category) => {
        setError('');
        setNotice('');
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
            setError('Choose a PDF, JPG, or PNG file.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Files must be 10 MB or smaller.');
            return;
        }
        if (!profile || profile.role === 'ADMIN')
            return;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
        const storagePath = `${userId}/${crypto.randomUUID()}/${safeName}`;
        setSaving(true);
        try {
            const { error: uploadError } = await client.storage.from('private-verification-documents').upload(storagePath, file, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false,
            });
            if (uploadError)
                throw uploadError;
            const { error: recordError } = await client.from('documents').insert({
                owner_id: userId,
                owner_type: profile.role,
                document_category: category,
                file_name: file.name,
                storage_path: storagePath,
                mime_type: file.type,
                file_size: file.size,
            });
            if (recordError) {
                const { error: cleanupError } = await client.storage.from('private-verification-documents').remove([storagePath]);
                if (cleanupError)
                    throw new Error(`${recordError.message} The uploaded file needs administrator cleanup.`);
                throw recordError;
            }
            setNotice('Document uploaded. It remains private and is awaiting manual review.');
            await loadAccount();
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : 'The document could not be uploaded.');
        }
        finally {
            setSaving(false);
        }
    };
    const markNotificationsRead = async () => {
        const { error: readError } = await client.rpc('mark_notifications_read', { p_notification_id: null });
        if (readError)
            setError(readError.message);
        else
            await loadAccount();
    };
    const createOpportunity = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        const { error: createError } = await client.from('opportunities').insert({
            temple_id: userId,
            title: opportunityForm.title.trim(),
            description: opportunityForm.description.trim(),
            location: opportunityForm.location.trim(),
            compensation: opportunityForm.compensation.trim() || null,
            status: 'DRAFT',
        });
        if (createError)
            setError(createError.message);
        else {
            setNotice('Recruitment draft saved.');
            setOpportunityForm(emptyOpportunity);
            await loadAccount();
        }
        setSaving(false);
    };
    const updateOpportunityStatus = async (opportunity, status) => {
        setError('');
        setNotice('');
        const { error: updateError } = await client.from('opportunities').update({
            status,
            published_at: status === 'PUBLISHED' ? new Date().toISOString() : opportunity.published_at,
        }).eq('id', opportunity.id);
        if (updateError)
            setError(status === 'PUBLISHED' ? `Publishing failed: ${updateError.message}` : updateError.message);
        else {
            setNotice(status === 'PUBLISHED' ? 'Recruitment post published.' : `Recruitment post marked ${formatStatus(status).toLowerCase()}.`);
            await loadAccount();
        }
    };
    const applyToOpportunity = async (opportunityId) => {
        setError('');
        const { error: applyError } = await client.from('applications').insert({ opportunity_id: opportunityId, priest_id: userId });
        if (applyError)
            setError(applyError.message);
        else {
            setNotice('Your application has been submitted.');
            await loadAccount();
        }
    };
    const updateApplication = async (application, status) => {
        const { error: updateError } = await client.from('applications').update({ status }).eq('id', application.id);
        if (updateError)
            setError(updateError.message);
        else {
            setNotice('Application status updated.');
            await loadAccount();
        }
    };
    const reviewProfile = async () => {
        if (!selectedAdminProfile || !selectedCategory) {
            setError('Select a profile and verification category.');
            return;
        }
        setError('');
        setNotice('');
        setSaving(true);
        const { error: reviewError } = await client.rpc('review_profile', {
            p_owner_id: selectedAdminProfile.id,
            p_status: reviewStatus,
            p_category: selectedCategory,
            p_remarks: reviewRemarks.trim() || null,
            p_verification_basis: verificationBasis.trim() || null,
        });
        if (reviewError)
            setError(reviewError.message);
        else {
            setNotice('The category review has been recorded in the audit history.');
            await loadAccount();
            const { data: refreshed, error: profileError } = await client.from('profiles').select('*').eq('id', selectedAdminProfile.id).single();
            if (profileError)
                setError(profileError.message);
            else
                await loadAdminReview(refreshed);
        }
        setSaving(false);
    };
    const reviewDocument = async () => {
        if (!selectedDocument)
            return;
        setError('');
        setSaving(true);
        const { error: reviewError } = await client.rpc('review_document', {
            p_document_id: selectedDocument.id,
            p_status: documentStatus,
            p_remarks: reviewRemarks.trim() || null,
        });
        if (reviewError)
            setError(reviewError.message);
        else {
            setNotice('Document review saved.');
            setSelectedDocument({ ...selectedDocument, verification_status: documentStatus, admin_remarks: reviewRemarks.trim() || null });
            await loadAccount();
        }
        setSaving(false);
    };
    const previewDocument = async (document) => {
        const requestId = ++previewRequest.current;
        setError('');
        setSelectedDocument(document);
        setDocumentPreview('');
        setDocumentStatus(document.verification_status);
        setReviewRemarks(document.admin_remarks ?? '');
        const { data, error: urlError } = await client.storage
            .from('private-verification-documents')
            .createSignedUrl(document.storage_path, 60);
        if (requestId !== previewRequest.current)
            return;
        if (urlError)
            setError(urlError.message);
        else
            setDocumentPreview(data.signedUrl);
    };
    const changeAccountStatus = async (account) => {
        const nextStatus = account.account_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        const { error: statusError } = await client.rpc('admin_set_account_status', {
            p_user_id: account.id,
            p_status: nextStatus,
            p_remarks: `Changed by administrator to ${nextStatus}.`,
        });
        if (statusError)
            setError(statusError.message);
        else {
            setNotice(`Account ${nextStatus.toLowerCase()}.`);
            await loadAccount();
        }
    };
    if (loading) {
        return <main className={tw("loading-screen")}><span className={tw("loader")}/>Loading your secure workspace…</main>;
    }
    if (!profile) {
        return <main className={tw("loading-screen")}><div className={tw("error-card")}><h2>Account unavailable</h2><p>{error}</p><button className={tw("button button-outline")} onClick={onSignOut}>Sign out</button></div></main>;
    }
    const navItems = isAdmin
        ? [
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'members', label: 'People & temples', icon: Users },
            { id: 'documents', label: 'Documents', icon: FileCheck2 },
            { id: 'review', label: 'Review workspace', icon: ClipboardCheck },
        ]
        : [
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'profile', label: isTemple ? 'Temple profile' : 'My profile', icon: UserRound },
            ...(isPriest ? [{ id: 'opportunities', label: 'Find opportunities', icon: BriefcaseBusiness }] : []),
            ...(isTemple ? [{ id: 'recruitment', label: 'Recruitment', icon: BriefcaseBusiness }] : []),
            ...(isTemple ? [{ id: 'applicants', label: 'Applicants', icon: Users }] : []),
            ...(isPriest ? [{ id: 'applications', label: 'My applications', icon: ClipboardCheck }] : []),
            { id: 'documents', label: 'Documents', icon: FileText },
        ];
    const unreadCount = notifications.filter((item) => !item.read_at).length;
    const activeSection = navItems.find((item) => item.id === activeTab)?.label ?? 'Overview';
    const categories = selectedAdminProfile?.role === 'PRIEST' ? priestCategories : templeCategories;
    const accountDocuments = isAdmin
        ? adminDocuments.filter((item) => item.owner_id === selectedAdminProfile?.id)
        : documents;
    const template = profile.verification_status === 'CORRECTION_REQUIRED' || profile.verification_status === 'REJECTED';
    return (<div className={tw("app-shell")}>
      <aside className={tw("sidebar")}>
        <a className={tw("brand")} href="#" onClick={(event) => { event.preventDefault(); setActiveTab('overview'); }}>
          <span className={tw("brand-mark")}><Flower2 size={21}/></span><span>MandirSetu<small>Seva, brought together</small></span>
        </a>
        <div className={tw("workspace-label")}>{isAdmin ? 'ADMIN CONSOLE' : 'YOUR WORKSPACE'}</div>
        <nav className={tw("side-nav")} aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (<button type="button" className={tw(`nav-item ${activeTab === id ? 'active' : ''}`)} key={id} onClick={() => setActiveTab(id)}>
              <Icon size={18}/><span>{label}</span>
              {id === 'documents' && (isAdmin ? pendingDocumentCount : documents.filter((item) => item.verification_status === 'PENDING').length) > 0 &&
                <span className={tw("nav-count")}>{isAdmin ? pendingDocumentCount : documents.filter((item) => item.verification_status === 'PENDING').length}</span>}
            </button>))}
        </nav>
        <div className={tw("sidebar-bottom")}>
          <div className={tw("support-card")}><span className={tw("support-icon")}><CircleHelp size={17}/></span><strong>Need a hand?</strong><p>Our team is here to help you along the way.</p><a href="mailto:support@mandirsetu.in">Contact support <ArrowRight size={13}/></a></div>
          <button type="button" className={tw("account-button")} onClick={onSignOut}><span className={tw("avatar")}>{profile.full_name.slice(0, 1).toUpperCase()}</span><span className={tw("account-label")}><strong>{profile.full_name}</strong><small>{isAdmin ? 'Administrator' : formatStatus(profile.role)}</small></span><LogOut size={17}/></button>
        </div>
      </aside>

      <main className={tw("main-area")}>
        <header className={tw("topbar")}>
          <div className={tw("breadcrumbs")}><span>MandirSetu</span><span>/</span><strong>{activeSection}</strong></div>
          <div className={tw("topbar-actions")}>
            <button type="button" className={tw("icon-button notification-button")} aria-label={`View notifications, ${unreadCount} unread`} onClick={() => setActiveTab('overview')}>
              <Bell size={18}/>{unreadCount > 0 && <span className={tw("notification-dot")}/>}
            </button>
          </div>
        </header>

        <div className={tw("content-area")}>
          {error && <div className={tw("alert alert-error")} role="alert"><X size={17}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
          {notice && <div className={tw("alert alert-success")} role="status"><Check size={17}/><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}><X size={16}/></button></div>}

          {isAdmin && activeTab === 'overview' && (<>
              <section className={tw("page-heading")}><div><span className={tw("eyebrow")}>ADMINISTRATION</span><h1>Review with care.</h1><p>Every profile is reviewed by a person. Documents are supporting material, never a prerequisite.</p></div><span className={tw("admin-shield")}><ShieldCheck size={20}/> Admin access</span></section>
              <div className={tw("stats-grid")}>
                <StatCard label="Registered priests" value={priestCount} note="Across all account statuses" icon={UserRound} tone="violet"/>
                <StatCard label="Temple organisations" value={templeCount} note="Trusts, institutions & committees" icon={Flower2} tone="gold"/>
                <StatCard label="Awaiting attention" value={pendingVerificationCount} note="Pending, in review or corrections" icon={ClipboardCheck} tone="blue"/>
                <StatCard label="Profiles without files" value={profilesWithoutDocuments} note="Can still be fully reviewed" icon={FileText} tone="green"/>
              </div>
              <div className={tw("stats-grid compact-stats")}>
                <StatCard label="Documents awaiting review" value={pendingDocumentCount} note="Private files" icon={FileCheck2} tone="blue"/>
                <StatCard label="Verified profiles" value={adminProfiles.filter((item) => item.verification_status === 'VERIFIED').length} note="Manually reviewed" icon={ShieldCheck} tone="green"/>
                <StatCard label="Correction requests" value={adminProfiles.filter((item) => item.verification_status === 'CORRECTION_REQUIRED').length} note="Waiting for an update" icon={Sparkles} tone="gold"/>
                <StatCard label="Rejected profiles" value={adminProfiles.filter((item) => item.verification_status === 'REJECTED').length} note="Decision includes a reason" icon={X} tone="violet"/>
              </div>
              <section className={tw("panel-section")}><div className={tw("section-heading")}><div><h2>Needs your attention</h2><p>Profiles submitted for manual review</p></div><button className={tw("text-button")} onClick={() => setActiveTab('members')}>View all <ArrowRight size={15}/></button></div><ProfileTable profiles={adminProfiles.filter((item) => item.verification_status !== 'NOT_SUBMITTED').slice(0, 5)} onReview={(item) => void loadAdminReview(item)} onAccountStatus={changeAccountStatus}/></section>
            </>)}

          {isAdmin && activeTab === 'members' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>MEMBER DIRECTORY</span><h1>People & temples</h1><p>Review accounts, profile details, and manual verification progress.</p></div></section>
              <section className={tw("panel-section directory-panel")}>
                <div className={tw("filter-row")}>
                  <label className={tw("search-field")}><Search size={16}/><input placeholder="Search name or mobile" value={search} onChange={(event) => setSearch(event.target.value)}/></label>
                  <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by account type"><option value="ALL">All account types</option><option value="PRIEST">Priests</option><option value="TEMPLE_MANAGEMENT">Temple management</option></select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by verification status"><option value="ALL">All statuses</option>{['NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'CORRECTION_REQUIRED', 'REJECTED'].map((status) => <option value={status} key={status}>{formatStatus(status)}</option>)}</select>
                  <label className={tw("date-filter")}><span>Submitted after</span><input aria-label="Submitted after" type="date" value={submittedAfter} onChange={(event) => setSubmittedAfter(event.target.value)}/></label>
                  <label className={tw("date-filter")}><span>Submitted before</span><input aria-label="Submitted before" type="date" value={submittedBefore} onChange={(event) => setSubmittedBefore(event.target.value)}/></label>
                </div>
                <ProfileTable profiles={visibleProfiles} onReview={(item) => void loadAdminReview(item)} onAccountStatus={changeAccountStatus}/>
              </section>
            </>)}

          {isAdmin && activeTab === 'review' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>MANUAL VERIFICATION</span><h1>Review workspace</h1><p>Record the decision and its basis. Do not treat platform review as government certification.</p></div></section>
              {!selectedAdminProfile ? (<section className={tw("panel-section")}><EmptyState icon={ClipboardCheck} title="Choose a profile to review" detail="Select a member from People & temples, or choose one below."/><ProfileTable profiles={adminProfiles.filter((item) => item.verification_status !== 'NOT_SUBMITTED')} onReview={(item) => void loadAdminReview(item)} onAccountStatus={changeAccountStatus}/></section>) : (<div className={tw("review-layout")}>
                  <div className={tw("review-main")}>
                    <section className={tw("panel-section review-person")}>
                      <div className={tw("section-heading")}><div><span className={tw("eyebrow")}>PROFILE DETAILS</span><h2>{selectedAdminProfile.full_name}</h2><p>{formatStatus(selectedAdminProfile.role)} · {selectedAdminProfile.email ?? 'No email linked'}</p></div><StatusBadge status={selectedAdminProfile.verification_status}/></div>
                      <div className={tw("review-facts")}><span><small>Contact phone</small><strong>{selectedAdminProfile.phone ?? 'Not provided'}</strong></span><span><small>Account status</small><strong>{formatStatus(selectedAdminProfile.account_status)}</strong></span><span><small>Submitted</small><strong>{selectedAdminProfile.created_at ? new Date(selectedAdminProfile.created_at).toLocaleDateString() : '—'}</strong></span></div>
                      {selectedAdminProfile.role === 'PRIEST' ? <PriestReviewInfo client={client} profileId={selectedAdminProfile.id}/> : <TempleReviewInfo client={client} profileId={selectedAdminProfile.id}/>}
                    </section>

                    <section className={tw("panel-section")}>
                      <div className={tw("section-heading")}><div><h2>Supporting documents</h2><p>Optional. Missing documents are never a reason for automatic rejection.</p></div><span className={tw("soft-chip")}>{accountDocuments.length} files</span></div>
                      {accountDocuments.length === 0 ? <EmptyState icon={FileText} title="No documents submitted" detail="You can review profile information and use alternative evidence when appropriate."/> : (<div className={tw("document-list")}>{accountDocuments.map((document) => (<article className={tw("document-row")} key={document.id}>
                            <span className={tw("document-icon")}><FileText size={17}/></span>
                            <div className={tw("document-copy")}><strong>{document.file_name}</strong><small>{formatStatus(document.document_category)} · {formatFileSize(document.file_size)}</small></div>
                            <StatusBadge status={document.verification_status}/>
                            <button className={tw("button button-outline button-small")} onClick={() => void previewDocument(document)}><ArrowDownToLine size={14}/> Preview</button>
                          </article>))}</div>)}
                      {selectedDocument && <div className={tw("document-review-box")}><div className={tw("section-heading")}><div><h3>Review document</h3><p>{selectedDocument.file_name}</p></div>{documentPreview && <a className={tw("text-button")} href={documentPreview} target="_blank" rel="noreferrer">Open secure preview <ArrowRight size={14}/></a>}</div><div className={tw("form-grid")}><label className={tw("field")}><span>Decision</span><select value={documentStatus} onChange={(event) => setDocumentStatus(event.target.value)}>{['UNDER_REVIEW', 'VERIFIED', 'CORRECTION_REQUIRED', 'REJECTED'].map((status) => <option value={status} key={status}>{formatStatus(status)}</option>)}</select></label><label className={tw("field")}><span>Admin remarks</span><input value={reviewRemarks} onChange={(event) => setReviewRemarks(event.target.value)} placeholder="Explain any changes requested"/></label></div><button className={tw("button button-primary button-small")} onClick={() => void reviewDocument()} disabled={saving}>Save document review</button></div>}
                    </section>

                    <section className={tw("panel-section")}>
                      <div className={tw("section-heading")}><div><h2>Verification history</h2><p>Category-level review record</p></div><button className={tw("text-button")} onClick={() => setActiveTab('members')}>Back to directory</button></div>
                      {adminVerifications.length === 0 ? <EmptyState icon={ClipboardCheck} title="Not submitted for review" detail="The member has not submitted their profile yet."/> : <div className={tw("verification-list")}>{adminVerifications.map((item) => <div className={tw("verification-row")} key={item.id}><div><strong>{formatStatus(item.verification_category)}</strong><small>{item.reviewed_at ? `Reviewed ${new Date(item.reviewed_at).toLocaleString()}` : item.submitted_at ? `Submitted ${new Date(item.submitted_at).toLocaleDateString()}` : 'Not submitted'}</small>{item.internal_remarks && <p>{item.internal_remarks}</p>}{item.verification_basis && <p><b>Basis:</b> {item.verification_basis}</p>}</div><StatusBadge status={item.status}/></div>)}</div>}
                      <div className={tw("audit-heading")}><h3>Audit timeline</h3><span>{auditHistory.length} events</span></div>
                      {auditHistory.length === 0 ? <p className={tw("muted")}>No review actions have been recorded yet.</p> : <div className={tw("audit-list")}>{auditHistory.map((event) => <article className={tw("audit-row")} key={event.id}><span className={tw("audit-dot")}/><div><strong>{formatStatus(event.action)}{event.verification_category ? ` · ${formatStatus(event.verification_category)}` : ''}</strong><small>{new Date(event.created_at).toLocaleString()}</small>{(event.previous_status || event.new_status) && <small>{event.previous_status ? formatStatus(event.previous_status) : 'Created'} → {event.new_status ? formatStatus(event.new_status) : '—'}</small>}{event.remarks && <p>{event.remarks}</p>}</div></article>)}</div>}
                    </section>
                  </div>

                  <aside className={tw("review-sidebar")}>
                    <section className={tw("panel-section review-decision")}>
                      <span className={tw("eyebrow")}>RECORD DECISION</span>
                      <h2>Category review</h2>
                      <label className={tw("field")}><span>Verification category</span><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} disabled={!adminVerifications.length}><option value="">Choose category</option>{categories.map((category) => <option value={category} key={category}>{formatStatus(category)}</option>)}</select></label>
                      <label className={tw("field")}><span>Decision</span><select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>{['UNDER_REVIEW', 'VERIFIED', 'CORRECTION_REQUIRED', 'REJECTED'].map((status) => <option value={status} key={status}>{formatStatus(status)}</option>)}</select></label>
                      <label className={tw("field")}><span>Remarks {reviewStatus === 'CORRECTION_REQUIRED' || reviewStatus === 'REJECTED' ? '(required)' : '(optional)'}</span><textarea rows={4} value={reviewRemarks} onChange={(event) => setReviewRemarks(event.target.value)} placeholder="Explain what was reviewed or what needs attention."/></label>
                      {reviewStatus === 'VERIFIED' && <label className={tw("field")}><span>Verification basis (required)</span><textarea rows={4} value={verificationBasis} onChange={(event) => setVerificationBasis(event.target.value)} placeholder="Record the evidence and basis for this category decision, including alternatives to documents if applicable."/></label>}
                      <p className={tw("review-note")}><ShieldCheck size={15}/> Overall verification is granted only after every required category is approved. Documents are optional.</p>
                      <button className={tw("button button-primary full-button")} onClick={() => void reviewProfile()} disabled={saving || !adminVerifications.length}>{saving ? 'Saving…' : 'Save review decision'} <ArrowRight size={16}/></button>
                    </section>
                  </aside>
                </div>)}
            </>)}

          {isAdmin && activeTab === 'documents' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>PRIVATE FILES</span><h1>Document queue</h1><p>Review document-level status separately from the account’s overall verification.</p></div></section>
              <section className={tw("panel-section")}>{adminDocuments.length === 0 ? <EmptyState icon={FileText} title="No documents submitted" detail="The review queue is clear. Members can submit optional supporting files later."/> : <div className={tw("document-list")}>{adminDocuments.map((document) => <article className={tw("document-row")} key={document.id}><span className={tw("document-icon")}><FileText size={17}/></span><div className={tw("document-copy")}><strong>{document.file_name}</strong><small>{formatStatus(document.owner_type)} · {formatStatus(document.document_category)} · {formatFileSize(document.file_size)}</small></div><StatusBadge status={document.verification_status}/><button className={tw("button button-outline button-small")} onClick={() => { const owner = adminProfiles.find((item) => item.id === document.owner_id); if (owner)
            void loadAdminReview(owner).then(() => previewDocument(document)); }}>Review file</button></article>)}</div>}</section>
            </>)}

          {!isAdmin && activeTab === 'overview' && (<>
              <section className={tw("welcome-banner")}><div className={tw("welcome-copy")}><span className={tw("eyebrow light-eyebrow")}>NAMASTE, {profile.full_name.split(' ')[0].toUpperCase()}</span><h1>{isPriest ? 'Your next chapter in seva starts here.' : 'A stronger community starts with you.'}</h1><p>{isPriest ? 'Build your professional profile, then explore opportunities that align with your experience.' : 'Tell your story, invite dedicated priests, and grow your service to the community.'}</p><button className={tw("button button-light")} onClick={() => setActiveTab('profile')}>Complete your profile <ArrowRight size={16}/></button></div><div className={tw("welcome-art")} aria-hidden="true"><Flower2 size={116} strokeWidth={0.75}/></div></section>
              <div className={tw("overview-grid")}>
                <section className={tw("panel-section profile-progress")}>
                  <div className={tw("section-heading")}><div><h2>Your verification</h2><p>Every review is completed by our team</p></div><StatusBadge status={profile.verification_status}/></div>
                  <div className={tw("progress-track")}><span style={{ width: profile.verification_status === 'VERIFIED' ? '100%' : profile.verification_status === 'NOT_SUBMITTED' ? '28%' : '68%' }}/></div>
                  <div className={tw("progress-steps")}><span className={"done"}><Check size={12}/> Profile</span><span className={(profile.verification_status !== 'NOT_SUBMITTED' ? "done" : "")}>Review</span><span className={(profile.verification_status === 'VERIFIED' ? "done" : "")}>Decision</span></div>
                  {verifications.length > 0 && <div className={tw("category-progress")}>{verifications.map((item) => <div className={tw("category-progress-row")} key={item.id}><span>{formatStatus(item.verification_category)}</span><StatusBadge status={item.status}/></div>)}</div>}
                  {template && <div className={tw("correction-note")}><Sparkles size={16}/><span>There’s feedback from the review team. Update your profile or add requested documents, then resubmit.</span></div>}
                  {profile.verification_status === 'VERIFIED' && <div className={tw("review-note")}><ShieldCheck size={16}/><span>Manually reviewed by MandirSetu. This is not government certification.</span></div>}
                  <button className={tw("button button-primary")} onClick={() => setActiveTab('profile')}>{profile.verification_status === 'NOT_SUBMITTED' ? 'Complete profile' : 'View profile'} <ArrowRight size={15}/></button>
                  {profile.verification_status !== 'VERIFIED' && <button className={tw("button button-outline")} onClick={() => void submitForReview()} disabled={saving || profile.verification_status === 'PENDING' || profile.verification_status === 'UNDER_REVIEW'}>{saving ? 'Submitting…' : profile.verification_status === 'CORRECTION_REQUIRED' || profile.verification_status === 'REJECTED' ? 'Resubmit for review' : 'Submit for review'}</button>}
                  <p className={tw("optional-note")}>Documents are optional. You can submit now and add them later.</p>
                </section>
                <section className={tw("panel-section notifications-panel")}><div className={tw("section-heading")}><div><h2>Recent updates</h2><p>Messages about your account</p></div>{unreadCount > 0 && <button className={tw("icon-button")} aria-label="Mark all notifications read" onClick={() => void markNotificationsRead()}><CheckCheck size={17}/></button>}</div>{notifications.length === 0 ? <EmptyState icon={Bell} title="You’re all caught up" detail="Important review updates will appear here."/> : <div className={tw("notification-list")}>{notifications.slice(0, 5).map((item) => <article className={tw(`notification-item ${!item.read_at ? 'unread' : ''}`)} key={item.id}><span className={tw("notification-mark")}><Bell size={15}/></span><div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleDateString()}</small></div></article>)}</div>}</section>
              </div>
              <section className={tw("privacy-strip")}><span className={tw("privacy-icon")}><ShieldCheck size={19}/></span><div><strong>Your information is handled with care</strong><p>Private documents are only visible to you and authorised reviewers. We do not collect Aadhaar details or claim government certification.</p></div><a href="/privacy.html" target="_blank" rel="noreferrer">Privacy notice <ArrowRight size={14}/></a></section>
            </>)}

          {!isAdmin && activeTab === 'profile' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>YOUR DETAILS</span><h1>{isTemple ? 'Tell us about your temple' : 'Your seva profile'}</h1><p>Keep this information current. Supporting documents are optional at every step.</p></div><StatusBadge status={profile.verification_status}/></section>
              <div className={tw("profile-layout")}>
                <section className={tw("panel-section profile-form-panel")}><div className={tw("section-heading")}><div><h2>Profile information</h2><p>Fields with an asterisk are required</p></div></div>
                  <form className={tw("form-stack")} onSubmit={(event) => void saveProfile(event)}>
                    <div className={tw("form-grid")}>
                      <label className={tw("field")}><span>{isTemple ? 'Representative full name *' : 'Full name *'}</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} required minLength={2} maxLength={120}/></label>
                      <label className={tw("field")}><span>Contact phone (optional)</span><input type="tel" inputMode="tel" autoComplete="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+91 98765 43210"/><small>Optional and never used to sign in. Use international format, such as +91 followed by your number.</small></label>
                    </div>
                    {isPriest && <PriestProfileFields value={priestForm} onChange={setPriestForm}/>}
                    {isTemple && <TempleProfileFields value={templeForm} onChange={setTempleForm}/>}
                    <div className={tw("profile-form-footer")}><span>Save updates as you go. No document is required.</span><button type="submit" className={tw("button button-primary")} disabled={saving}>{saving ? 'Saving…' : 'Save profile'} <ArrowRight size={15}/></button></div>
                  </form>
                </section>
                <aside className={tw("profile-aside")}><div className={tw("panel-section")}><span className={tw("aside-icon")}><ClipboardCheck size={20}/></span><h3>Review feedback</h3>{verifications.filter((item) => item.internal_remarks || item.rejection_reason).length === 0 ? <p className={tw("muted")}>If our team needs a change or additional information, the request will show here.</p> : verifications.filter((item) => item.internal_remarks || item.rejection_reason).map((item) => <div className={tw("feedback-item")} key={item.id}><StatusBadge status={item.status}/><strong>{formatStatus(item.verification_category)}</strong><p>{item.rejection_reason ?? item.internal_remarks}</p></div>)}</div><div className={tw("panel-section")}><span className={tw("aside-icon gold")}><FileCheck2 size={20}/></span><h3>Documents (optional)</h3><p className={tw("muted")}>Share supporting certificates or letters if you have them. You can skip this now and upload later.</p><button type="button" className={tw("button button-outline button-small")} onClick={() => setActiveTab('documents')}>Manage documents <ArrowRight size={14}/></button></div></aside>
              </div>
            </>)}

          {!isAdmin && activeTab === 'documents' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>SUPPORTING MATERIAL</span><h1>Your documents</h1><p>Share relevant documents if you have them. Uploading is completely optional.</p></div><span className={tw("optional-tag")}>OPTIONAL</span></section>
              <div className={tw("documents-layout")}>
                <section className={tw("panel-section")}>
                  <div className={tw("section-heading")}><div><h2>Uploaded files</h2><p>Only you and authorised reviewers can access these private files.</p></div><span className={tw("soft-chip")}>{documents.length} files</span></div>
                  {documents.length === 0 ? <EmptyState icon={FileText} title="No documents yet" detail="That’s okay. You can submit your profile for manual review without any attachments."/> : <div className={tw("document-list")}>{documents.map((document) => <article className={tw("document-row")} key={document.id}><span className={tw("document-icon")}><FileText size={17}/></span><div className={tw("document-copy")}><strong>{document.file_name}</strong><small>{formatStatus(document.document_category)} · {formatFileSize(document.file_size)} · {new Date(document.uploaded_at).toLocaleDateString()}</small>{document.admin_remarks && <small className={"document-remarks"}>{document.admin_remarks}</small>}</div><StatusBadge status={document.verification_status}/>{(document.verification_status === 'CORRECTION_REQUIRED' || document.verification_status === 'REJECTED') && <label className={tw("button button-outline button-small upload-again")}>Replace<input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { const file = event.target.files?.[0]; if (file)
            void uploadDocument(file, document.document_category); event.currentTarget.value = ''; }}/></label>}</article>)}</div>}
                </section>
                <aside className={tw("panel-section upload-panel")}><span className={tw("aside-icon")}><ArrowDownToLine size={19}/></span><span className={tw("optional-tag")}>OPTIONAL</span><h2>Add a supporting document</h2><p className={tw("muted")}>PDF, JPG or PNG · 10 MB maximum. For your security, uploads are private and cannot be replaced in place; a new version is stored separately.</p><DocumentUpload role={profile.role} busy={saving} onUpload={uploadDocument}/><button className={tw("upload-skip")} type="button" onClick={() => setActiveTab('overview')}><Check size={15}/> Skip for now — no file is required</button></aside>
              </div>
            </>)}

          {isPriest && activeTab === 'opportunities' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>FIND YOUR NEXT SEVA</span><h1>Opportunities</h1><p>Explore roles shared by verified temple organisations.</p></div><span className={tw("soft-chip")}>{publicOpportunities.length} open roles</span></section>
              {publicOpportunities.length === 0 ? <section className={tw("panel-section")}><EmptyState icon={BriefcaseBusiness} title="No opportunities just yet" detail="Verified temples will appear here when they publish recruitment posts."/></section> : <div className={tw("opportunity-grid")}>{publicOpportunities.map((item) => {
                    const applied = applications.some((application) => application.opportunity_id === item.id);
                    return <article className={tw("opportunity-card")} key={item.id}><div className={tw("opportunity-top")}><span className={tw("org-avatar")}><Flower2 size={18}/></span><StatusBadge status="VERIFIED"/></div><h2>{item.title}</h2><p className={tw("opportunity-org")}>{item.temple_name}</p><p className={tw("opportunity-description")}>{item.description}</p><div className={tw("opportunity-meta")}><span><MapPin size={14}/>{item.location}</span>{item.compensation && <span>{item.compensation}</span>}</div><button className={tw(`button ${applied ? 'button-outline' : 'button-primary'} full-button`)} disabled={applied} onClick={() => void applyToOpportunity(item.id)}>{applied ? 'Application sent' : 'Apply for this role'}{!applied && <ArrowRight size={15}/>}</button></article>;
                })}</div>}
            </>)}

          {isPriest && activeTab === 'applications' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>YOUR APPLICATIONS</span><h1>Application tracker</h1><p>Follow the progress of roles you have applied for.</p></div></section>
              <section className={tw("panel-section")}>{applications.length === 0 ? <EmptyState icon={ClipboardCheck} title="No applications yet" detail="When you apply to an opportunity, its status will be tracked here."/> : <ApplicationList applications={applications} opportunities={publicOpportunities}/>}</section>
            </>)}

          {isTemple && activeTab === 'recruitment' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>RECRUITMENT</span><h1>Find the right seva</h1><p>Create a draft at any time. Publishing requires an approved temple profile.</p></div><StatusBadge status={profile.verification_status}/></section>
              {profile.verification_status !== 'VERIFIED' && <div className={tw("alert alert-info")}><ShieldCheck size={17}/><span>Your profile must be verified before a recruitment post can be published. You can still save a private draft.</span></div>}
              <div className={tw("recruitment-layout")}><section className={tw("panel-section")}><div className={tw("section-heading")}><div><h2>Your posts</h2><p>Drafts stay private until published</p></div></div>{opportunities.length === 0 ? <EmptyState icon={BriefcaseBusiness} title="No recruitment posts" detail="Create a draft when you’re ready to welcome applications."/> : <div className={tw("recruitment-list")}>{opportunities.map((item) => <article className={tw("recruitment-row")} key={item.id}><div><strong>{item.title}</strong><small>{item.location} · Updated {new Date(item.updated_at).toLocaleDateString()}</small></div><StatusBadge status={item.status}/>{item.status === 'DRAFT' && <button className={tw("button button-primary button-small")} disabled={profile.verification_status !== 'VERIFIED'} onClick={() => void updateOpportunityStatus(item, 'PUBLISHED')}>Publish</button>}{item.status === 'PUBLISHED' && <button className={tw("button button-outline button-small")} onClick={() => void updateOpportunityStatus(item, 'CLOSED')}>Close post</button>}</article>)}</div>}</section>
                <section className={tw("panel-section")}><div className={tw("section-heading")}><div><h2>Create a draft</h2><p>Publish after your temple profile is verified</p></div></div><form className={tw("form-stack")} onSubmit={(event) => void createOpportunity(event)}><label className={tw("field")}><span>Role title *</span><input value={opportunityForm.title} onChange={(event) => setOpportunityForm({ ...opportunityForm, title: event.target.value })} minLength={5} maxLength={160} required/></label><label className={tw("field")}><span>Location *</span><input value={opportunityForm.location} onChange={(event) => setOpportunityForm({ ...opportunityForm, location: event.target.value })} required/></label><label className={tw("field")}><span>Role description *</span><textarea rows={5} value={opportunityForm.description} onChange={(event) => setOpportunityForm({ ...opportunityForm, description: event.target.value })} required/></label><label className={tw("field")}><span>Honorarium or compensation</span><input value={opportunityForm.compensation} onChange={(event) => setOpportunityForm({ ...opportunityForm, compensation: event.target.value })}/></label><button className={tw("button button-primary")} type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save as draft'} <ArrowRight size={15}/></button></form></section></div>
            </>)}

          {isTemple && activeTab === 'applicants' && (<>
              <section className={tw("page-heading compact-heading")}><div><span className={tw("eyebrow")}>APPLICANT MANAGEMENT</span><h1>Applications received</h1><p>Applicants can only see their own application details.</p></div></section>
              <section className={tw("panel-section")}>{templeApplications.length === 0 ? <EmptyState icon={Users} title="No applicants yet" detail="Applications to your published posts will show here."/> : <ApplicantList applications={templeApplications} opportunities={opportunities} onUpdate={updateApplication}/>}</section>
            </>)}
        </div>
      </main>
    </div>);
}
function ProfileTable({ profiles, onReview, onAccountStatus }) {
    if (profiles.length === 0)
        return <EmptyState icon={Users} title="No accounts match" detail="Try changing your filters or search terms."/>;
    return <div className={tw("table-scroll")}><table className={tw("data-table")}><thead><tr><th>Member</th><th>Account type</th><th>Verification</th><th>Email</th><th>Contact phone</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{profiles.map((item) => <tr key={item.id}><td><div className={tw("member-cell")}><span className={tw("avatar small-avatar")}>{item.full_name.slice(0, 1).toUpperCase()}</span><span><strong>{item.full_name}</strong><small>{formatStatus(item.account_status)}</small></span></div></td><td>{formatStatus(item.role)}</td><td><StatusBadge status={item.verification_status}/></td><td>{item.email ?? 'No email linked'}</td><td>{item.phone ?? 'Not provided'}<small className={tw("table-subtext")}>Contact only</small></td><td>{new Date(item.created_at).toLocaleDateString()}</td><td><div className={tw("table-actions")}><button className={tw("button button-primary button-small")} onClick={() => onReview(item)}>Review</button><button className={tw("button button-outline button-small")} onClick={() => onAccountStatus(item)}>{item.account_status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button></div></td></tr>)}</tbody></table></div>;
}
function PriestProfileFields({ value, onChange }) {
    const update = (key, input) => onChange({ ...value, [key]: input });
    return <>
    <div className={tw("form-grid")}>
      <label className={tw("field")}><span>Years of experience</span><input type="number" min="0" max="80" step="1" value={value.experience_years} onChange={(event) => update('experience_years', event.target.value)} placeholder="e.g. 8"/></label>
      <label className={tw("field")}><span>Availability</span><input value={value.availability} onChange={(event) => update('availability', event.target.value)} placeholder="e.g. Available from next month"/></label>
      <label className={tw("field")}><span>Expected honorarium (INR)</span><input type="number" min="0" step="0.01" value={value.expected_honorarium} onChange={(event) => update('expected_honorarium', event.target.value)} placeholder="Optional"/></label>
      <label className={tw("field")}><span>Languages</span><input value={value.languages} onChange={(event) => update('languages', event.target.value)} placeholder="Hindi, Sanskrit, Tamil"/><small>Separate entries with commas.</small></label>
    </div>
    <label className={tw("field")}><span>Religious education</span><textarea rows={3} value={value.religious_education} onChange={(event) => update('religious_education', event.target.value)} placeholder="Share your studies or tradition, if applicable."/></label>
    <label className={tw("field")}><span>Qualifications and training</span><textarea rows={3} value={value.qualifications} onChange={(event) => update('qualifications', event.target.value)} placeholder="Describe relevant learning or qualifications."/></label>
    <div className={tw("form-grid")}><label className={tw("field")}><span>Ritual expertise</span><input value={value.expertise} onChange={(event) => update('expertise', event.target.value)} placeholder="Puja, homa, samskara"/><small>Separate entries with commas.</small></label><label className={tw("field")}><span>Preferred locations</span><input value={value.preferred_locations} onChange={(event) => update('preferred_locations', event.target.value)} placeholder="Jaipur, Delhi NCR"/><small>Separate entries with commas.</small></label></div>
    <label className={tw("checkbox-row")}><input type="checkbox" checked={value.public_listing} onChange={(event) => onChange({ ...value, public_listing: event.target.checked })}/><span><strong>Show a public profile after verification</strong><small>Optional. If selected, a limited profile without your phone number is visible to visitors after manual verification.</small></span></label>
  </>;
}
function TempleProfileFields({ value, onChange }) {
    const update = (key, input) => onChange({ ...value, [key]: input });
    return <>
    <label className={tw("field")}><span>Temple or organisation name *</span><input value={value.temple_name} onChange={(event) => update('temple_name', event.target.value)} required minLength={2} maxLength={180}/></label>
    <label className={tw("field")}><span>Legal structure *</span><select value={value.legal_structure} onChange={(event) => update('legal_structure', event.target.value)}><option value="REGISTERED_TRUST">Registered Trust</option><option value="REGISTERED_SOCIETY">Registered Society</option><option value="RELIGIOUS_INSTITUTION">Religious Institution</option><option value="INDIVIDUAL_OR_COMMITTEE">Individual or committee-managed temple</option><option value="OTHER">Other</option></select><small>Registration paperwork is not mandatory for all structures.</small></label>
    <div className={tw("form-grid")}><label className={tw("field")}><span>Registration number (if applicable)</span><input value={value.registration_number} onChange={(event) => update('registration_number', event.target.value)} placeholder="Optional"/></label><label className={tw("field")}><span>Representative contact number</span><input value={value.contact_phone} onChange={(event) => update('contact_phone', event.target.value)} placeholder="Optional"/></label><label className={tw("field")}><span>City</span><input value={value.city} onChange={(event) => update('city', event.target.value)}/></label><label className={tw("field")}><span>State</span><input value={value.state} onChange={(event) => update('state', event.target.value)}/></label></div>
    <label className={tw("field")}><span>Temple address</span><textarea rows={3} value={value.address} onChange={(event) => update('address', event.target.value)}/></label>
    <label className={tw("field")}><span>Management representative details</span><textarea rows={3} value={value.management_details} onChange={(event) => update('management_details', event.target.value)} placeholder="Your role and authority to represent this organisation."/></label>
    <label className={tw("checkbox-row")}><input type="checkbox" checked={value.public_listing} onChange={(event) => onChange({ ...value, public_listing: event.target.checked })}/><span><strong>Show a public temple profile after verification</strong><small>Optional. Your temple name and city/state are shown; private contact details are not.</small></span></label>
  </>;
}
function DocumentUpload({ role, busy, onUpload }) {
    const categories = role === 'PRIEST'
        ? ['RELIGIOUS_QUALIFICATION', 'EDUCATIONAL_CERTIFICATE', 'EXPERIENCE_CERTIFICATE', 'TRAINING_CERTIFICATE', 'RECOMMENDATION_LETTER', 'OTHER']
        : ['TRUST_OR_SOCIETY_REGISTRATION', 'GOVERNING_DOCUMENT', 'ORGANISATION_PAN', 'REPRESENTATIVE_AUTHORITY', 'TEMPLE_MANAGEMENT_PROOF', 'OTHER'];
    const [category, setCategory] = useState(categories[0]);
    return <div className={tw("form-stack")}><label className={tw("field")}><span>Document type <span className={tw("optional-inline")}>Optional</span></span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option value={item} key={item}>{formatStatus(item)}</option>)}</select></label><label className={tw(`upload-dropzone ${busy ? 'disabled' : ''}`)}><ArrowDownToLine size={20}/><strong>{busy ? 'Uploading…' : 'Choose a file'}</strong><span>PDF, JPG or PNG · up to 10 MB</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file)
        onUpload(file, category); event.currentTarget.value = ''; }}/></label></div>;
}
function ApplicationList({ applications, opportunities }) {
    const titleById = new Map(opportunities.map((item) => [item.id, item.title]));
    return <div className={tw("application-list")}>{applications.map((application) => <article className={tw("application-row")} key={application.id}><span className={tw("application-icon")}><BriefcaseBusiness size={18}/></span><div><strong>{titleById.get(application.opportunity_id) ?? 'Recruitment post'}</strong><small>Applied {new Date(application.created_at).toLocaleDateString()}</small></div><StatusBadge status={application.status}/></article>)}</div>;
}
function ApplicantList({ applications, opportunities, onUpdate }) {
    const titleById = new Map(opportunities.map((item) => [item.id, item.title]));
    return <div className={tw("application-list")}>{applications.map((application) => <article className={tw("application-row applicant-row")} key={application.id}><span className={tw("application-icon")}><UserRound size={18}/></span><div><strong>{application.full_name} · {titleById.get(application.opportunity_id) ?? 'Recruitment post'}</strong><small>{application.experience_years === null ? 'Experience not listed' : `${application.experience_years} years' experience`} · Applied {new Date(application.created_at).toLocaleDateString()}</small><small>{application.expertise.length ? `Expertise: ${application.expertise.join(', ')}` : 'Expertise not listed'}{application.languages.length ? ` · Languages: ${application.languages.join(', ')}` : ''}</small>{application.qualifications && <small>{application.qualifications}</small>}</div><StatusBadge status={application.status}/><select value={application.status} onChange={(event) => onUpdate(application, event.target.value)} aria-label={`Update applicant status for ${titleById.get(application.opportunity_id) ?? 'post'}`}><option value="SUBMITTED">Submitted</option><option value="REVIEWING">Reviewing</option><option value="SHORTLISTED">Shortlisted</option><option value="REJECTED">Rejected</option></select></article>)}</div>;
}
function PriestReviewInfo({ client, profileId }) {
    const [info, setInfo] = useState(null);
    useEffect(() => {
        let active = true;
        void client.from('priests').select('*').eq('profile_id', profileId).maybeSingle().then(({ data }) => { if (active)
            setInfo(data); });
        return () => { active = false; };
    }, [client, profileId]);
    if (!info)
        return <p className={tw("muted review-detail-placeholder")}>No professional profile has been completed.</p>;
    return <div className={tw("review-detail-grid")}><span><small>Experience</small><strong>{info.experience_years ?? 'Not provided'}{info.experience_years === null ? '' : ' years'}</strong></span><span><small>Availability</small><strong>{info.availability ?? 'Not provided'}</strong></span><span className={"wide"}><small>Education & qualifications</small><strong>{[info.religious_education, info.qualifications].filter(Boolean).join(' · ') || 'Not provided'}</strong></span><span className={"wide"}><small>Ritual expertise</small><strong>{info.expertise.join(', ') || 'Not provided'}</strong></span><span className={"wide"}><small>Languages & locations</small><strong>{[info.languages.join(', '), info.preferred_locations.join(', ')].filter(Boolean).join(' · ') || 'Not provided'}</strong></span></div>;
}
function TempleReviewInfo({ client, profileId }) {
    const [info, setInfo] = useState(null);
    useEffect(() => {
        let active = true;
        void client.from('temples').select('*').eq('profile_id', profileId).maybeSingle().then(({ data }) => { if (active)
            setInfo(data); });
        return () => { active = false; };
    }, [client, profileId]);
    if (!info)
        return <p className={tw("muted review-detail-placeholder")}>No temple profile has been completed.</p>;
    return <div className={tw("review-detail-grid")}><span><small>Temple / organisation</small><strong>{info.temple_name}</strong></span><span><small>Legal structure</small><strong>{formatStatus(info.legal_structure)}</strong></span><span className={"wide"}><small>Location</small><strong>{[info.address, info.city, info.state].filter(Boolean).join(', ') || 'Not provided'}</strong></span><span><small>Registration number</small><strong>{info.registration_number || 'Not applicable / not provided'}</strong></span><span><small>Representative phone</small><strong>{info.contact_phone || 'Not provided'}</strong></span><span className={"wide"}><small>Management details</small><strong>{info.management_details || 'Not provided'}</strong></span></div>;
}
