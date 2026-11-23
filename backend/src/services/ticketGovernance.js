const pool=require('../db/pool');
const OPS=new Set(['agent','operator','manager','admin','superadmin']);
const clean=(v,n=1000)=>String(v??'').trim().slice(0,n);


async function assignmentForAgent(database,userId,requestedGroupId=null){
    const r=await database.query(
        `SELECT g.id,
                g.name,
                gm.is_default_assignment
         FROM support_group_members gm
         JOIN support_groups g ON g.id=gm.group_id
         WHERE gm.user_id=$1
           AND COALESCE(g.is_active,TRUE)=TRUE
         ORDER BY gm.is_default_assignment DESC,
                  g.is_default_triage DESC,
                  g.name`,
        [userId]
    );

    if(!r.rowCount){
        throw Object.assign(
            new Error('The selected agent has no active support group.'),
            {status:409,code:'AGENT_SUPPORT_GROUP_REQUIRED'}
        );
    }

    // EXPLICIT_TICKET_GROUP_PRIORITY
    if(requestedGroupId){
        const explicit=r.rows.find(
            (membership)=>Number(membership.id)===Number(requestedGroupId)
        );
        if(!explicit){
            throw Object.assign(
                new Error('The selected agent is not an eligible member of this support group.'),
                {status:409,code:'AGENT_GROUP_MEMBERSHIP_MISMATCH'}
            );
        }
        return explicit;
    }

    const defaults=r.rows.filter((membership)=>membership.is_default_assignment);
    if(defaults.length>1){
        throw Object.assign(
            new Error('The selected agent has more than one governed default support group.'),
            {status:409,code:'MULTIPLE_DEFAULT_SUPPORT_GROUPS'}
        );
    }
    if(defaults.length===1)return defaults[0];
    if(r.rowCount===1)return r.rows[0];

    throw Object.assign(
        new Error('The selected agent belongs to multiple support groups. Select the support group for this ticket.'),
        {status:409,code:'SUPPORT_GROUP_SELECTION_REQUIRED'}
    );
}

async function governedAssignment(database,groupId,assigneeId){
    if(!assigneeId){
        return {groupId:groupId||null,assigneeId:null,locked:false};
    }
    const group=await assignmentForAgent(database,assigneeId,groupId||null);
    return{
        groupId:Number(group.id),
        assigneeId:Number(assigneeId),
        locked:Boolean(groupId),
        groupName:group.name
    };
}
function requesterPriority(user,value,options={})
        {
            const p=clean(value,30)||'Medium';
            const permittedPdmHigh=options.allowHigh===true&&p==='High';
            if(!OPS.has(clean(user?.role,30).toLowerCase())&&['High','Critical'].includes(p)&&!permittedPdmHigh)
                throw Object.assign(new Error('Requesters may create only Low or Medium priority tickets.'),
                    {status:403,code:'REQUESTER_PRIORITY_RESTRICTED'});
                    return p;
        }
function catalogueRequirement(type,details,category,subCategory)
        {if
            (!['incident','service_request'].includes(type)
            )
            return null;
        const itemId=clean(details.catalogItemId||details.catalogueItemId,160);
        const itemName=clean(details.catalogItemName||details.catalogueItemName||subCategory||category,200);
        if(!itemId||!itemName)
            throw Object.assign(new Error('Select an active Incident or Service Catalogue item.'),
                {status:400,code:'GOVERNED_CATALOGUE_ITEM_REQUIRED'});
                return {itemId,itemName};
        }
async function escalationTargets(database,ticketId)
        {const r=await database.query(
                    `SELECT t.id,
                    t.status,
                    t.assigned_to_user_id,
                    t.assigned_group_id,
                    assignee.manager_user_id,
                    group_row.manager_user_id
                    group_manager_id,
                    group_row.escalation_user_id,
                    u.department
                    FROM tickets t
                    LEFT JOIN users assignee
                    ON assignee.id=t.assigned_to_user_id
                    LEFT JOIN users u
                    ON u.id=t.requester_id
                    LEFT JOIN support_groups
                    group_row
                    ON group_row.id=t.assigned_group_id
                    WHERE t.id=$1`,
                    [ticketId]);

                    const t=r.rows[0];
                    if(!t)
                        throw Object.assign(
                            new Error('Ticket not found.'),
                            {status:404});
                            if(['Resolved','Closed'].includes(t.status))
                                throw Object.assign(
                            new Error('Resolved or Closed tickets cannot be escalated.'),
                            {status:409,code:'FINAL_TICKET_ESCALATION_DISABLED'});

                    const targets=[];
                    if(t.manager_user_id)targets.push({userId:t.manager_user_id,level:'reporting_manager'});
                    if(t.group_manager_id)targets.push({userId:t.group_manager_id,level:'support_group_manager'});
                    if(t.escalation_user_id)targets.push({userId:t.escalation_user_id,level:'approved_senior'});
                    try{
                    const hod=await database.query(`
                        SELECT id
                        FROM users
                        WHERE department=$1
                        AND status='active'
                        AND archived_at IS NULL
                        AND (LOWER(COALESCE(job_title,''))
                        LIKE '%head of department%'
                        OR LOWER(COALESCE(job_title,'')) LIKE '%hod%')
                        ORDER BY id LIMIT 1`,[t.department]);
                        if(hod.rows[0])targets.push({userId:hod.rows[0].id,level:'department_hod'});
                    }
                    catch{}
                    return [...new Map(targets.map(x=>[`${x.userId}:${x.level}`,x])).values()];}

async function escalate(database,{ticketId,actorId,targetUserId,targetLevel,reason,requestedAction,source})

  {
     const targets=await escalationTargets(database,ticketId);
     const chosen=targets.find(x=>Number(x.userId)===Number(targetUserId)&&x.level===targetLevel);
     if(!chosen)
        throw Object.assign(
            new Error('The escalation target is outside the verified reporting, HOD or senior hierarchy.'),
            {status:403,code:'ESCALATION_TARGET_NOT_AUTHORISED'});
    const result=await database.query(`
        INSERT INTO ticket_escalations(
        ticket_id,
        initiated_by_user_id,
        target_user_id,
        target_level,
        reason,
        requested_action,
        source)
        VALUES($1,$2,$3,$4,$5,$6,$7)
        RETURNING *`,
        [ticketId,actorId,targetUserId,targetLevel,clean(reason),clean(requestedAction)||null,clean(source,40)||'helpdesk']);
        await database.query(`
            UPDATE tickets
            SET status='Escalated',
            updated_at=NOW()
            WHERE id=$1`,
            [ticketId]);

        return result.rows[0];}

module.exports={assignmentForAgent,governedAssignment,requesterPriority,catalogueRequirement,escalationTargets,escalate};
