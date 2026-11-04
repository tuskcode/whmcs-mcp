import { apiEndpoint } from './security/endpoint.js';
/**
 * WHMCS API Client
 * Handles authentication and API requests to WHMCS installations
 */

export interface WhmcsConfig {
    apiUrl: string;          // WHMCS installation URL (e.g., https://example.com/whmcs/)
    apiIdentifier: string;   // API credential identifier
    apiSecret: string;       // API credential secret
    allowInsecureLocalhost?: boolean;
    accessKey?: string;      // Optional access key for additional security
}

export interface WhmcsApiResponse {
    result: 'success' | 'error';
    message?: string;
    [key: string]: unknown;
}

export class WhmcsApiClient {
    private config: WhmcsConfig;

    constructor(config: WhmcsConfig) {
        this.config = config;
    }

    /**
     * Make an API request to WHMCS
     */
    async call<T extends WhmcsApiResponse>(action: string, params: Record<string, unknown> = {}): Promise<T> {
        const url = apiEndpoint(this.config.apiUrl, this.config.allowInsecureLocalhost);
        
        const postData: Record<string, string> = {
            identifier: this.config.apiIdentifier,
            secret: this.config.apiSecret,
            action: action,
            responsetype: 'json',
            ...this.flattenParams(params)
        };

        if (this.config.accessKey) {
            postData.accesskey = this.config.accessKey;
        }

        const response = await fetch(url, {
            method: 'POST',
            redirect: 'error',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(postData).toString(),
        });

        if (!response.ok) {
            throw new Error(`WHMCS API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as T;
        
        if (data.result === 'error') {
            throw new Error(`WHMCS API error: ${data.message || 'Unknown error'}`);
        }

        return data;
    }

    /**
     * Flatten nested params for URL encoding
     */
    private flattenParams(params: Record<string, unknown>, prefix = ''): Record<string, string> {
        const result: Record<string, string> = {};
        
        for (const [key, value] of Object.entries(params)) {
            const newKey = prefix ? `${prefix}[${key}]` : key;
            
            if (value === null || value === undefined) {
                continue;
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                Object.assign(result, this.flattenParams(value as Record<string, unknown>, newKey));
            } else if (Array.isArray(value)) {
                value.forEach((item, index) => {
                    if (typeof item === 'object') {
                        Object.assign(result, this.flattenParams(item as Record<string, unknown>, `${newKey}[${index}]`));
                    } else {
                        result[`${newKey}[${index}]`] = String(item);
                    }
                });
            } else {
                result[newKey] = String(value);
            }
        }
        
        return result;
    }

    // ========================================
    // CLIENT MANAGEMENT
    // ========================================

    /**
     * Get a list of clients
     */
    async getClients(params: {
        limitstart?: number;
        limitnum?: number;
        sorting?: 'ASC' | 'DESC';
        status?: string;
        search?: string;
        orderby?: string;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            clients: { client: Array<{
                id: number;
                firstname: string;
                lastname: string;
                companyname: string;
                email: string;
                datecreated: string;
                groupid: number;
                status: string;
            }> };
        }>('GetClients', params);
    }

    /**
     * Get details about a specific client
     */
    async getClientDetails(params: {
        clientid?: number;
        email?: string;
        stats?: boolean;
    }) {
        return this.call<WhmcsApiResponse & {
            client: {
                id: number;
                firstname: string;
                lastname: string;
                fullname: string;
                companyname: string;
                email: string;
                address1: string;
                address2: string;
                city: string;
                state: string;
                postcode: string;
                country: string;
                phonenumber: string;
                status: string;
                credit: string;
                taxexempt: boolean;
                latefeeoveride: boolean;
                overideduenotices: boolean;
                separateinvoices: boolean;
                disableautocc: boolean;
                emailoptout: boolean;
                overrideautoclose: boolean;
                allowSingleSignOn: number;
                language: string;
                lastlogin: string;
                currency_id: number;
                notes: string;
            };
        }>('GetClientsDetails', params);
    }

    /**
     * Add a new client
     */
    async addClient(params: {
        firstname: string;
        lastname: string;
        email: string;
        address1: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        phonenumber: string;
        password2: string;
        companyname?: string;
        address2?: string;
        currency?: number;
        clientip?: string;
        language?: string;
        groupid?: number;
        securityqid?: number;
        securityqans?: string;
        notes?: string;
        cardtype?: string;
        cardnum?: string;
        expdate?: string;
        startdate?: string;
        issuenumber?: string;
        cvv?: string;
        noemail?: boolean;
        skipvalidation?: boolean;
    }) {
        return this.call<WhmcsApiResponse & {
            clientid: number;
            owner_user_id: number;
        }>('AddClient', params);
    }

    /**
     * Update an existing client
     */
    async updateClient(params: {
        clientid: number;
        firstname?: string;
        lastname?: string;
        companyname?: string;
        email?: string;
        address1?: string;
        address2?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
        phonenumber?: string;
        password2?: string;
        status?: string;
        credit?: string;
        taxexempt?: boolean;
        latefeeoveride?: boolean;
        overideduenotices?: boolean;
        separateinvoices?: boolean;
        disableautocc?: boolean;
        emailoptout?: boolean;
        language?: string;
        notes?: string;
    }) {
        return this.call<WhmcsApiResponse & { clientid: number }>('UpdateClient', params);
    }

    /**
     * Delete a client
     */
    async deleteClient(params: { clientid: number }) {
        return this.call<WhmcsApiResponse>('DeleteClient', params);
    }

    /**
     * Get client's products/services
     */
    async getClientProducts(params: {
        clientid?: number;
        serviceid?: number;
        domain?: string;
        pid?: number;
        username2?: string;
        limitstart?: number;
        limitnum?: number;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            products: { product: Array<{
                id: number;
                clientid: number;
                orderid: number;
                pid: number;
                regdate: string;
                name: string;
                translated_name: string;
                groupname: string;
                translated_groupname: string;
                domain: string;
                dedicatedip: string;
                serverid: number;
                servername: string;
                serverip: string;
                serverhostname: string;
                suspensionreason: string;
                firstpaymentamount: string;
                recurringamount: string;
                paymentmethod: string;
                paymentmethodname: string;
                billingcycle: string;
                nextduedate: string;
                status: string;
                username: string;
                password: string;
                subscriptionid: string;
                promoid: number;
                overideautosuspend: string;
                overidesuspenduntil: string;
                ns1: string;
                ns2: string;
                assignedips: string;
                notes: string;
                diskusage: number;
                disklimit: number;
                bwusage: number;
                bwlimit: number;
                lastupdate: string;
            }> };
        }>('GetClientsProducts', params);
    }

    /**
     * Get client's domains
     */
    async getClientDomains(params: {
        clientid?: number;
        domainid?: number;
        domain?: string;
        limitstart?: number;
        limitnum?: number;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            domains: { domain: Array<{
                id: number;
                userid: number;
                orderid: number;
                regtype: string;
                domainname: string;
                registrar: string;
                regperiod: number;
                firstpaymentamount: string;
                recurringamount: string;
                paymentmethod: string;
                paymentmethodname: string;
                regdate: string;
                expirydate: string;
                nextduedate: string;
                status: string;
                subscriptionid: string;
                promoid: number;
                dnsmanagement: string;
                emailforwarding: string;
                idprotection: string;
                donotrenew: string;
                notes: string;
            }> };
        }>('GetClientsDomains', params);
    }

    // ========================================
    // PRODUCT MANAGEMENT
    // ========================================

    /**
     * Get products
     */
    async getProducts(params: {
        pid?: number;
        gid?: number;
        module?: string;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            products: { product: Array<{
                pid: number;
                gid: number;
                type: string;
                name: string;
                description: string;
                module: string;
                paytype: string;
                pricing: Record<string, {
                    prefix: string;
                    suffix: string;
                    msetupfee: string;
                    qsetupfee: string;
                    ssetupfee: string;
                    asetupfee: string;
                    bsetupfee: string;
                    tsetupfee: string;
                    monthly: string;
                    quarterly: string;
                    semiannually: string;
                    annually: string;
                    biennially: string;
                    triennially: string;
                }>;
            }> };
        }>('GetProducts', params);
    }

    /**
     * Get product groups
     */
    async getProductGroups() {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            productgroups: { productgroup: Array<{
                id: number;
                name: string;
                headline: string;
                tagline: string;
                orderfrmtpl: string;
            }> };
        }>('GetProductGroups');
    }

    // ========================================
    // BILLING & INVOICES
    // ========================================

    /**
     * Get invoices
     */
    async getInvoices(params: {
        limitstart?: number;
        limitnum?: number;
        userid?: number;
        status?: 'Paid' | 'Unpaid' | 'Cancelled' | 'Refunded' | 'Collections' | 'Draft';
        orderby?: string;
        order?: 'asc' | 'desc';
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            invoices: { invoice: Array<{
                id: number;
                userid: number;
                firstname: string;
                lastname: string;
                companyname: string;
                invoicenum: string;
                date: string;
                duedate: string;
                datepaid: string;
                last_capture_attempt: string;
                subtotal: string;
                credit: string;
                tax: string;
                tax2: string;
                total: string;
                taxrate: string;
                taxrate2: string;
                status: string;
                paymentmethod: string;
                paymethodid: string | null;
                notes: string;
                currencycode: string;
                currencyprefix: string;
                currencysuffix: string;
            }> };
        }>('GetInvoices', params);
    }

    /**
     * Get invoice details
     */
    async getInvoice(params: { invoiceid: number }) {
        return this.call<WhmcsApiResponse & {
            invoiceid: number;
            invoicenum: string;
            userid: number;
            date: string;
            duedate: string;
            datepaid: string;
            status: string;
            paymentmethod: string;
            paymethodid: string | null;
            subtotal: string;
            credit: string;
            tax: string;
            tax2: string;
            total: string;
            balance: string;
            taxrate: string;
            taxrate2: string;
            currencycode: string;
            currencyprefix: string;
            currencysuffix: string;
            notes: string;
            ccgateway: boolean;
            items: { item: Array<{
                id: number;
                type: string;
                relid: number;
                description: string;
                amount: string;
                taxed: number;
            }> };
            transactions: { transaction: Array<{
                id: number;
                userid: number;
                currency: number;
                gateway: string;
                date: string;
                description: string;
                amountin: string;
                amountout: string;
                rate: string;
                transid: string;
                invoiceid: number;
                refundid: number;
            }> };
        }>('GetInvoice', params);
    }

    /**
     * Create an invoice
     */
    async createInvoice(params: {
        userid: number;
        status?: 'Draft' | 'Unpaid' | 'Paid' | 'Cancelled' | 'Refunded' | 'Collections';
        sendinvoice?: boolean;
        paymentmethod?: string;
        taxrate?: number;
        taxrate2?: number;
        date?: string;
        duedate?: string;
        notes?: string;
        itemdescription?: string[];
        itemamount?: number[];
        itemtaxed?: boolean[];
    }) {
        return this.call<WhmcsApiResponse & {
            invoiceid: number;
            status: string;
        }>('CreateInvoice', params);
    }

    /**
     * Update an invoice
     */
    async updateInvoice(params: {
        invoiceid: number;
        status?: 'Draft' | 'Unpaid' | 'Paid' | 'Cancelled' | 'Refunded' | 'Collections';
        paymentmethod?: string;
        taxrate?: number;
        taxrate2?: number;
        date?: string;
        duedate?: string;
        datepaid?: string;
        notes?: string;
        itemdescription?: string[];
        itemamount?: number[];
        itemtaxed?: boolean[];
        newitemdescription?: string[];
        newitemamount?: number[];
        newitemtaxed?: boolean[];
        deletelineids?: number[];
        publish?: boolean;
        publishandsendemail?: boolean;
    }) {
        return this.call<WhmcsApiResponse & { invoiceid: number }>('UpdateInvoice', params);
    }

    /**
     * Add a payment to an invoice
     */
    async addPayment(params: {
        invoiceid: number;
        transid: string;
        gateway: string;
        amount?: number;
        fees?: number;
        noemail?: boolean;
        date?: string;
    }) {
        return this.call<WhmcsApiResponse>('AddInvoicePayment', params);
    }

    /**
     * Apply credit to an invoice
     */
    async applyCredit(params: {
        invoiceid: number;
        amount: number;
        noemail?: boolean;
    }) {
        return this.call<WhmcsApiResponse & { invoiceid: number }>('ApplyCredit', params);
    }

    /**
     * Get transactions
     */
    async getTransactions(params: {
        invoiceid?: number;
        clientid?: number;
        transid?: string;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            transactions: { transaction: Array<{
                id: number;
                userid: number;
                currency: number;
                gateway: string;
                date: string;
                description: string;
                amountin: string;
                amountout: string;
                rate: string;
                transid: string;
                invoiceid: number;
                refundid: number;
            }> };
        }>('GetTransactions', params);
    }

    // ========================================
    // SUPPORT TICKETS
    // ========================================

    /**
     * Get support tickets
     */
    async getTickets(params: {
        limitstart?: number;
        limitnum?: number;
        deptid?: number;
        clientid?: number;
        email?: string;
        status?: string;
        subject?: string;
        ignore_dept_assignments?: boolean;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            tickets: { ticket: Array<{
                id: number;
                tid: string;
                deptid: number;
                deptname: string;
                userid: number;
                name: string;
                email: string;
                cc: string;
                c: string;
                date: string;
                subject: string;
                status: string;
                priority: string;
                admin: string;
                attachment: string;
                lastreply: string;
                flag: number;
                service: string;
            }> };
        }>('GetTickets', params);
    }

    /**
     * Get ticket details
     */
    async getTicket(params: { ticketid: number }) {
        return this.call<WhmcsApiResponse & {
            ticketid: number;
            tid: string;
            c: string;
            deptid: number;
            deptname: string;
            userid: number;
            contactid: number;
            name: string;
            email: string;
            cc: string;
            date: string;
            subject: string;
            status: string;
            priority: string;
            admin: string;
            lastreply: string;
            flag: number;
            service: string;
            replies: { reply: Array<{
                replyid: number;
                userid: number;
                contactid: number;
                name: string;
                email: string;
                requestor_name: string;
                requestor_email: string;
                requestor_type: string;
                admin: string;
                date: string;
                message: string;
                attachment: string;
                attachments_removed: boolean;
                rating: number;
            }> };
            notes: { note: Array<{
                noteid: number;
                admin: string;
                date: string;
                message: string;
                attachments: string[];
                attachments_removed: boolean;
            }> };
        }>('GetTicket', params);
    }

    /**
     * Open a new support ticket
     */
    async openTicket(params: {
        deptid: number;
        subject: string;
        message: string;
        clientid?: number;
        contactid?: number;
        name?: string;
        email?: string;
        priority?: 'Low' | 'Medium' | 'High';
        serviceid?: number;
        domainid?: number;
        admin?: boolean;
        markdown?: boolean;
        attachments?: Array<{ name: string; data: string }>;
        customfields?: string;
    }) {
        return this.call<WhmcsApiResponse & {
            id: number;
            tid: string;
            c: string;
        }>('OpenTicket', params);
    }

    /**
     * Reply to a ticket
     */
    async addTicketReply(params: {
        ticketid: number;
        message: string;
        clientid?: number;
        contactid?: number;
        name?: string;
        email?: string;
        adminusername?: string;
        status?: string;
        noemail?: boolean;
        customfields?: string;
        attachments?: Array<{ name: string; data: string }>;
        markdown?: boolean;
    }) {
        return this.call<WhmcsApiResponse>('AddTicketReply', params);
    }

    /**
     * Update ticket status
     */
    async updateTicket(params: {
        ticketid: number;
        deptid?: number;
        subject?: string;
        userid?: number;
        name?: string;
        email?: string;
        cc?: string;
        priority?: 'Low' | 'Medium' | 'High';
        status?: string;
        flag?: number;
        removeattachments?: boolean;
        message?: string;
        markdown?: boolean;
        customfields?: string;
    }) {
        return this.call<WhmcsApiResponse & { ticketid: number }>('UpdateTicket', params);
    }

    /**
     * Delete a ticket
     */
    async deleteTicket(params: { ticketid: number }) {
        return this.call<WhmcsApiResponse>('DeleteTicket', params);
    }

    /**
     * Get support departments
     */
    async getSupportDepartments(params: { ignore_dept_assignments?: boolean } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            departments: { department: Array<{
                id: number;
                name: string;
                awaitingreply: number;
                opentickets: number;
            }> };
        }>('GetSupportDepartments', params);
    }

    /**
     * Get ticket statuses
     */
    async getSupportStatuses(params: { deptid?: number } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            statuses: { status: Array<{
                title: string;
                count: number;
                color: string;
            }> };
        }>('GetSupportStatuses', params);
    }

    // ========================================
    // DOMAIN MANAGEMENT
    // ========================================

    /**
     * Register a domain
     */
    async registerDomain(params: {
        domainid?: number;
        domain?: string;
    }) {
        return this.call<WhmcsApiResponse>('DomainRegister', params);
    }

    /**
     * Transfer a domain
     */
    async transferDomain(params: {
        domainid: number;
    }) {
        return this.call<WhmcsApiResponse>('DomainTransfer', params);
    }

    /**
     * Renew a domain
     */
    async renewDomain(params: {
        domainid: number;
    }) {
        return this.call<WhmcsApiResponse>('DomainRenew', params);
    }

    /**
     * Get domain WHOIS info
     */
    async getDomainWhoisInfo(params: { domainid: number }) {
        return this.call<WhmcsApiResponse & {
            status: string;
            domain: {
                registrant: Record<string, string>;
                admin: Record<string, string>;
                tech: Record<string, string>;
                billing: Record<string, string>;
            };
        }>('DomainWhois', params);
    }

    /**
     * Update domain nameservers
     */
    async updateDomainNameservers(params: {
        domainid: number;
        ns1?: string;
        ns2?: string;
        ns3?: string;
        ns4?: string;
        ns5?: string;
    }) {
        return this.call<WhmcsApiResponse>('DomainUpdateNameservers', params);
    }

    /**
     * Get domain nameservers
     */
    async getDomainNameservers(params: { domainid: number }) {
        return this.call<WhmcsApiResponse & {
            ns1: string;
            ns2: string;
            ns3: string;
            ns4: string;
            ns5: string;
        }>('DomainGetNameservers', params);
    }

    /**
     * Update domain lock status
     */
    async updateDomainLockingStatus(params: {
        domainid: number;
        lockstatus?: boolean;
    }) {
        return this.call<WhmcsApiResponse>('DomainUpdateLockingStatus', params);
    }

    /**
     * Get domain locking status
     */
    async getDomainLockingStatus(params: { domainid: number }) {
        return this.call<WhmcsApiResponse & { lockstatus: string }>('DomainGetLockingStatus', params);
    }

    /**
     * Get TLD pricing
     */
    async getTLDPricing(params: {
        currencyid?: number;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            currency: {
                id: number;
                code: string;
                prefix: string;
                suffix: string;
            };
            pricing: Record<string, {
                categories: string[];
                addons: {
                    dns: boolean;
                    email: boolean;
                    idprotect: boolean;
                };
                register: Record<string, string>;
                transfer: Record<string, string>;
                renew: Record<string, string>;
                grace_period: Record<string, unknown>;
                redemption: Record<string, unknown>;
            }>;
        }>('GetTLDPricing', params);
    }

    /**
     * Check domain availability
     */
    async domainWhoisLookup(params: { domain: string }) {
        return this.call<WhmcsApiResponse & {
            status: string;
            whois: string;
        }>('DomainWhois', params);
    }

    // ========================================
    // ORDERS
    // ========================================

    /**
     * Get orders
     */
    async getOrders(params: {
        limitstart?: number;
        limitnum?: number;
        id?: number;
        userid?: number;
        status?: string;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            orders: { order: Array<{
                id: number;
                ordernum: string;
                userid: number;
                contactid: number;
                requestor_id: number;
                date: string;
                nameservers: string;
                transfersecret: string;
                renewals: string;
                promocode: string;
                promotype: string;
                promovalue: string;
                orderdata: string;
                amount: string;
                paymentmethod: string;
                invoiceid: number;
                status: string;
                ipaddress: string;
                fraudmodule: string;
                fraudoutput: string;
                notes: string;
                paymentmethodname: string;
                paymentstatus: string;
                lineitems: { lineitem: Array<{
                    type: string;
                    relid: number;
                    producttype: string;
                    product: string;
                    domain: string;
                    billingcycle: string;
                    amount: string;
                    status: string;
                }> };
            }> };
        }>('GetOrders', params);
    }

    /**
     * Accept an order
     */
    async acceptOrder(params: {
        orderid: number;
        serverid?: number;
        serviceusername?: string;
        servicepassword?: string;
        registrar?: string;
        sendregistrar?: boolean;
        autosetup?: boolean;
        sendemail?: boolean;
    }) {
        return this.call<WhmcsApiResponse>('AcceptOrder', params);
    }

    /**
     * Cancel an order
     */
    async cancelOrder(params: {
        orderid: number;
        cancelsub?: boolean;
        noemail?: boolean;
    }) {
        return this.call<WhmcsApiResponse>('CancelOrder', params);
    }

    /**
     * Delete an order
     */
    async deleteOrder(params: { orderid: number }) {
        return this.call<WhmcsApiResponse>('DeleteOrder', params);
    }

    /**
     * Mark order as fraudulent
     */
    async fraudOrder(params: {
        orderid: number;
        cancelsub?: boolean;
    }) {
        return this.call<WhmcsApiResponse>('FraudOrder', params);
    }

    /**
     * Set order to pending
     */
    async pendingOrder(params: { orderid: number }) {
        return this.call<WhmcsApiResponse>('PendingOrder', params);
    }

    // ========================================
    // SERVER MANAGEMENT
    // ========================================

    /**
     * Get servers
     */
    async getServers(params: {
        fetchStatus?: boolean;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            servers: { server: Array<{
                id: number;
                name: string;
                hostname: string;
                ipaddress: string;
                assignedips: string;
                active: boolean;
                disabled: boolean;
                type: string;
                maxaccounts: number;
                statusaddress: string;
                ns1: string;
                ns1ip: string;
                ns2: string;
                ns2ip: string;
                ns3: string;
                ns3ip: string;
                ns4: string;
                ns4ip: string;
            }> };
        }>('GetServers', params);
    }

    // ========================================
    // MODULES
    // ========================================

    /**
     * Execute a module command (create, suspend, unsuspend, terminate, etc.)
     */
    async moduleCommand(params: {
        accountid: number;
        func: 'create' | 'suspend' | 'unsuspend' | 'terminate' | 'changepassword' | 'changepackage' | string;
        servicepassword?: string;
    }) {
        return this.call<WhmcsApiResponse>('ModuleCustom', {
            ...params,
            action: 'ModuleCustom'
        });
    }

    /**
     * Create a module account
     */
    async moduleCreate(params: { accountid: number }) {
        return this.call<WhmcsApiResponse>('ModuleCreate', params);
    }

    /**
     * Suspend a module account
     */
    async moduleSuspend(params: {
        accountid: number;
        suspendreason?: string;
    }) {
        return this.call<WhmcsApiResponse>('ModuleSuspend', params);
    }

    /**
     * Unsuspend a module account
     */
    async moduleUnsuspend(params: { accountid: number }) {
        return this.call<WhmcsApiResponse>('ModuleUnsuspend', params);
    }

    /**
     * Terminate a module account
     */
    async moduleTerminate(params: { accountid: number }) {
        return this.call<WhmcsApiResponse>('ModuleTerminate', params);
    }

    /**
     * Change module password
     */
    async moduleChangePassword(params: {
        accountid: number;
        servicepassword?: string;
    }) {
        return this.call<WhmcsApiResponse>('ModuleChangePassword', params);
    }

    // ========================================
    // SYSTEM
    // ========================================

    /**
     * Get system stats
     */
    async getStats() {
        return this.call<WhmcsApiResponse & {
            income_today: string;
            income_thismonth: string;
            income_thisyear: string;
            income_alltime: string;
            orders_pending: number;
            orders_today_cancelled: number;
            orders_today_pending: number;
            orders_today_fraud: number;
            orders_today_active: number;
            orders_today_total: number;
            orders_yesterday_cancelled: number;
            orders_yesterday_pending: number;
            orders_yesterday_fraud: number;
            orders_yesterday_active: number;
            orders_yesterday_total: number;
            orders_thismonth_total: number;
            orders_thisyear_total: number;
            tickets_allactive: number;
            tickets_awaitingreply: number;
            tickets_flaggedtickets: number;
            cancellations_pending: number;
            todoitems_due: number;
            networkissues_open: number;
            billableitems_uninvoiced: number;
            quotes_valid: number;
        }>('GetStats');
    }

    /**
     * Get admin users
     */
    async getAdminUsers() {
        return this.call<WhmcsApiResponse & {
            admin_users: Array<{
                id: number;
                uuid: string;
                roleId: number;
                username: string;
                twoFactorAuthModule: string;
                firstname: string;
                lastname: string;
                email: string;
                signature: string;
                notes: string;
                template: string;
                language: string;
                isDisabled: boolean;
                loginAttempts: number;
                supportDepartmentIds: string;
                receivesTicketNotifications: string;
                homeWidgets: string;
                hiddenMenus: string;
                fullName: string;
                gravatarHash: string;
            }>;
        }>('GetAdminUsers');
    }

    /**
     * Get payment methods
     */
    async getPaymentMethods() {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            paymentmethods: { paymentmethod: Array<{
                module: string;
                displayname: string;
            }> };
        }>('GetPaymentMethods');
    }

    /**
     * Get currencies
     */
    async getCurrencies() {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            currencies: { currency: Array<{
                id: number;
                code: string;
                prefix: string;
                suffix: string;
                format: number;
                rate: string;
                default: number;
            }> };
        }>('GetCurrencies');
    }

    /**
     * Get activity log
     */
    async getActivityLog(params: {
        limitstart?: number;
        limitnum?: number;
        userid?: number;
        date?: string;
        user?: string;
        description?: string;
        ipaddress?: string;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            activity: { entry: Array<{
                id: number;
                date: string;
                user: string;
                description: string;
                ipaddress: string;
                userid: number;
            }> };
        }>('GetActivityLog', params);
    }

    /**
     * Get email templates
     */
    async getEmailTemplates(params: {
        type?: 'general' | 'product' | 'domain' | 'invoice' | 'support' | 'affiliate';
        language?: string;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            emailtemplates: { emailtemplate: Array<{
                id: number;
                name: string;
                subject: string;
                custom: boolean;
            }> };
        }>('GetEmailTemplates', params);
    }

    /**
     * Send email to client
     */
    async sendEmail(params: {
        messagename?: string;
        id?: number;
        customtype?: string;
        customsubject?: string;
        custommessage?: string;
        customvars?: string;
    }) {
        return this.call<WhmcsApiResponse>('SendEmail', params);
    }

    /**
     * Log activity
     */
    async logActivity(params: {
        description: string;
        userid?: number;
    }) {
        return this.call<WhmcsApiResponse>('LogActivity', params);
    }

    /**
     * Get to-do items
     */
    async getToDoItems(params: {
        limitstart?: number;
        limitnum?: number;
        status?: 'Incomplete' | 'Complete' | 'Pending';
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            items: { item: Array<{
                id: number;
                date: string;
                title: string;
                description: string;
                status: string;
                duedate: string;
                admin: number;
                adminname: string;
            }> };
        }>('GetToDoItems', params);
    }

    // ========================================
    // AFFILIATES
    // ========================================

    /**
     * Get affiliates
     */
    async getAffiliates(params: {
        limitstart?: number;
        limitnum?: number;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            affiliates: { affiliate: Array<{
                id: number;
                userid: number;
                date: string;
                visitors: number;
                paytype: string;
                payamount: string;
                onetime: string;
                balance: string;
                withdrawn: string;
            }> };
        }>('GetAffiliates', params);
    }

    /**
     * Activate affiliate
     */
    async affiliateActivate(params: { userid: number }) {
        return this.call<WhmcsApiResponse & { affiliateid: number }>('AffiliateActivate', params);
    }

    // ========================================
    // PROMOTIONS
    // ========================================

    /**
     * Get promotions
     */
    async getPromotions(params: { code?: string } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            promotions: { promotion: Array<{
                id: number;
                code: string;
                type: string;
                recurring: number;
                value: string;
                cycles: string;
                appliesto: string;
                requires: string;
                requiresexisting: number;
                startdate: string;
                expirationdate: string;
                maxuses: number;
                uses: number;
                lifetimepromo: number;
                applyonce: number;
                newsignups: number;
                existingclient: number;
                onceperclient: number;
                recurfor: number;
                upgrades: number;
                upgradeconfig: string;
                notes: string;
            }> };
        }>('GetPromotions', params);
    }

    // ========================================
    // QUOTES
    // ========================================

    /**
     * Get quotes
     */
    async getQuotes(params: {
        limitstart?: number;
        limitnum?: number;
        quoteid?: number;
        userid?: number;
        subject?: string;
        stage?: string;
        datecreated?: string;
        lastmodified?: string;
        validuntil?: string;
    } = {}) {
        return this.call<WhmcsApiResponse & {
            totalresults: number;
            startnumber: number;
            numreturned: number;
            quotes: { quote: Array<{
                id: number;
                subject: string;
                stage: string;
                validuntil: string;
                userid: number;
                firstname: string;
                lastname: string;
                companyname: string;
                email: string;
                datecreated: string;
                lastmodified: string;
                datesent: string;
                dateaccepted: string;
                total: string;
            }> };
        }>('GetQuotes', params);
    }

    /**
     * Create a quote
     */
    async createQuote(params: {
        subject: string;
        stage: 'Draft' | 'Delivered' | 'On Hold' | 'Accepted' | 'Lost' | 'Dead';
        validuntil: string;
        userid?: number;
        firstname?: string;
        lastname?: string;
        companyname?: string;
        email?: string;
        address1?: string;
        address2?: string;
        city?: string;
        state?: string;
        postcode?: string;
        country?: string;
        phonenumber?: string;
        currency?: number;
        proposal?: string;
        customernotes?: string;
        adminnotes?: string;
        lineitems?: Array<{
            desc: string;
            qty: number;
            up: number;
            discount: number;
            taxable: boolean;
        }>;
    }) {
        return this.call<WhmcsApiResponse & { quoteid: number }>('CreateQuote', params);
    }

    /**
     * Accept a quote
     */
    async acceptQuote(params: { quoteid: number }) {
        return this.call<WhmcsApiResponse & {
            quoteid: number;
            invoiceid: number;
        }>('AcceptQuote', params);
    }

    /**
     * Delete a quote
     */
    async deleteQuote(params: { quoteid: number }) {
        return this.call<WhmcsApiResponse>('DeleteQuote', params);
    }
}
