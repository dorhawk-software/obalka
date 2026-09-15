// AUTO-GENERATED from src/services/isds/schema/v20/*.xsd - DO NOT EDIT.
// Regenerate with: npm run codegen:isds
/* eslint-disable */

export type tIdDm = string;

export type tIdDb = string;

export type tDmType = string;

export type tUserID = string;

export type tIsdsID = string;

export type tDbType = "FO" | "PFO" | "PFO_REQ" | "PFO_ADVOK" | "PFO_DANPOR" | "PFO_INSSPR" | "PFO_AUDITOR" | "PFO_ZNALEC" | "PFO_TLUMOCNIK" | "PFO_ARCH" | "PFO_AIAT" | "PFO_AZI" | "PO" | "PO_ZAK" | "PO_REQ" | "OVM" | "OVM_NOTAR" | "OVM_EXEKUT" | "OVM_REQ" | "OVM_FO" | "OVM_PFO" | "OVM_PO";

export type tIdentificationNumber = string;

export type tUserType = "PRIMARY_USER" | "ENTRUSTED_USER" | "ADMINISTRATOR" | "OFFICIAL" | "OFFICIAL_CERT" | "LIQUIDATOR" | "RECEIVER" | "GUARDIAN";

export type tDbAccessDataId = string;

export interface tFile {
  dmEncodedContent?: string;
  dmXMLContent?: {
  [key: string]: unknown;
};
}

export interface tFilesArray {
  dmFile: tFile & {
  dmMimeType: string;
  dmFileMetaType: string;
  dmFileGuid?: string;
  dmUpFileGuid?: string;
  dmFileDescr: string;
  dmFormat?: string;
}[];
}

export interface tStatus {
  dmStatusCode: string;
  dmStatusMessage: string;
}

export interface tHash {
  value: string;
  algorithm?: string;
}

export interface tEvent {
  dmEventTime: string | null;
  dmEventDescr: string | null;
}

export interface tEventsArray {
  dmEvent: tEvent[];
}

export interface tRecipients {
  dbIDRecipient: tIdDb;
  dmRecipientOrgUnit?: string | null;
  dmRecipientOrgUnitNum?: number | null;
  dmToHands: string | null;
}

export interface tMultipleMessageEnvelopeSub {
  dmSenderOrgUnit: string | null;
  dmSenderOrgUnitNum: number | null;
  dmAnnotation: string | null;
  dmRecipientRefNumber: string | null;
  dmSenderRefNumber: string | null;
  dmRecipientIdent: string | null;
  dmSenderIdent: string | null;
  dmLegalTitleLaw: number | null;
  dmLegalTitleYear: number | null;
  dmLegalTitleSect: string | null;
  dmLegalTitlePar: string | null;
  dmLegalTitlePoint: string | null;
  dmPersonalDelivery: boolean | null;
  dmAllowSubstDelivery: boolean | null;
  dmOVM?: boolean | null;
  dmPublishOwnID?: {
  value: boolean;
  IdLevel?: number;
} | null;
}

export interface tMultipleMessageRecipients {
  dmRecipient: tRecipients[];
}

export interface tMultipleMessageCreateInput {
  dmRecipients: tMultipleMessageRecipients;
  dmEnvelope: tMultipleMessageEnvelopeSub & {
  dmType?: tDmType;
};
  dmFiles: tFilesArray;
}

export interface tMultipleStatus {
  dmSingleStatus: tMStatus[] | null;
}

export interface tMStatus {
  dmID?: tIdDm;
  dmStatus: tStatus;
}

export interface tMultipleMessageCreateOutput {
  dmMultipleStatus?: tMultipleStatus | null;
  dmStatus: tStatus;
}

export interface tReturnedMessage {
  dmDm: {
  dmID: tIdDm;
  dbIDSender: tIdDb | null;
  dmSender: string | null;
  dmSenderAddress: string | null;
  dmSenderType: number;
  dmRecipient: string | null;
  dmRecipientAddress: string | null;
  dmAmbiguousRecipient?: boolean | null;
  dmSenderOrgUnit: string | null;
  dmSenderOrgUnitNum: number | null;
  dbIDRecipient: tIdDb | null;
  dmRecipientOrgUnit: string | null;
  dmRecipientOrgUnitNum: number | null;
  dmToHands: string | null;
  dmAnnotation: string | null;
  dmRecipientRefNumber: string | null;
  dmSenderRefNumber: string | null;
  dmRecipientIdent: string | null;
  dmSenderIdent: string | null;
  dmLegalTitleLaw: number | null;
  dmLegalTitleYear: number | null;
  dmLegalTitleSect: string | null;
  dmLegalTitlePar: string | null;
  dmLegalTitlePoint: string | null;
  dmPersonalDelivery: boolean | null;
  dmAllowSubstDelivery: boolean | null;
  dmFiles: tFilesArray;
};
  dmHash: tHash;
  dmQTimestamp: string | null;
  dmDeliveryTime: string | null;
  dmAcceptanceTime: string | null;
  dmMessageStatus: number;
  dmAttachmentSize: number | null;
  dmType?: tDmType;
  specMessFlag?: number;
}

export interface tReturnedMessageEnvelope {
  dmDm: {
  dmID: tIdDm;
  dbIDSender: tIdDb | null;
  dmSender: string | null;
  dmSenderAddress: string | null;
  dmSenderType: number;
  dmRecipient: string | null;
  dmRecipientAddress: string | null;
  dmAmbiguousRecipient?: boolean | null;
  dmSenderOrgUnit: string | null;
  dmSenderOrgUnitNum: number | null;
  dbIDRecipient: tIdDb | null;
  dmRecipientOrgUnit: string | null;
  dmRecipientOrgUnitNum: number | null;
  dmToHands: string | null;
  dmAnnotation: string | null;
  dmRecipientRefNumber: string | null;
  dmSenderRefNumber: string | null;
  dmRecipientIdent: string | null;
  dmSenderIdent: string | null;
  dmLegalTitleLaw: number | null;
  dmLegalTitleYear: number | null;
  dmLegalTitleSect: string | null;
  dmLegalTitlePar: string | null;
  dmLegalTitlePoint: string | null;
  dmPersonalDelivery: boolean | null;
  dmAllowSubstDelivery: boolean | null;
};
  dmHash: tHash;
  dmQTimestamp: string;
  dmDeliveryTime: string | null;
  dmAcceptanceTime: string | null;
  dmMessageStatus: number;
  dmAttachmentSize: number | null;
  dmType?: tDmType;
  dmVODZ?: boolean;
  attsNum?: number;
  specMessFlag?: number;
}

export interface tMessageEnvelopeSub {
  dmSenderOrgUnit: string | null;
  dmSenderOrgUnitNum: number | null;
  dbIDRecipient: tIdDb | null;
  dmRecipientOrgUnit: string | null;
  dmRecipientOrgUnitNum: number | null;
  dmToHands: string | null;
  dmAnnotation: string | null;
  dmRecipientRefNumber: string | null;
  dmSenderRefNumber: string | null;
  dmRecipientIdent: string | null;
  dmSenderIdent: string | null;
  dmLegalTitleLaw: number | null;
  dmLegalTitleYear: number | null;
  dmLegalTitleSect: string | null;
  dmLegalTitlePar: string | null;
  dmLegalTitlePoint: string | null;
  dmPersonalDelivery: boolean | null;
  dmAllowSubstDelivery: boolean | null;
  dmOVM?: boolean | null;
  dmPublishOwnID?: {
  value: boolean;
  IdLevel?: number;
} | null;
  dmType?: tDmType;
}

export interface tMessageCreateInput {
  dmEnvelope: tMessageEnvelopeSub & {};
  dmFiles: tFilesArray;
}

export interface tMessageCreateOutput {
  dmID?: tIdDm;
  dmStatus: tStatus;
}

export interface tMessageVerifyOutput {
  dmHash?: tHash;
  dmStatus: tStatus;
}

export interface tDelivery {
  dmDm: {
  dmID: tIdDm;
  dbIDSender: tIdDb | null;
  dmSender: string | null;
  dmSenderAddress: string | null;
  dmSenderType: number;
  dmRecipient: string | null;
  dmRecipientAddress: string | null;
  dmAmbiguousRecipient?: boolean | null;
  dmSenderOrgUnit: string | null;
  dmSenderOrgUnitNum: number | null;
  dbIDRecipient: tIdDb | null;
  dmRecipientOrgUnit: string | null;
  dmRecipientOrgUnitNum: number | null;
  dmToHands: string | null;
  dmAnnotation: string | null;
  dmRecipientRefNumber: string | null;
  dmSenderRefNumber: string | null;
  dmRecipientIdent: string | null;
  dmSenderIdent: string | null;
  dmLegalTitleLaw: number | null;
  dmLegalTitleYear: number | null;
  dmLegalTitleSect: string | null;
  dmLegalTitlePar: string | null;
  dmLegalTitlePoint: string | null;
  dmPersonalDelivery: boolean | null;
  dmAllowSubstDelivery: boolean | null;
};
  dmHash: tHash;
  dmQTimestamp: string;
  dmDeliveryTime: string | null;
  dmAcceptanceTime: string | null;
  dmMessageStatus: number;
  dmEvents: tEventsArray;
}

export interface tDeliveryMessageOutput {
  dmDelivery?: tDelivery | null;
  dmStatus?: tStatus;
}

export interface tSignDelivMessOutput {
  dmSignature?: string;
  dmStatus: tStatus;
}

export interface tRecord {
  dmOrdinal: number;
  dmID: tIdDm;
  dbIDSender: tIdDb | null;
  dmSender: string | null;
  dmSenderAddress: string | null;
  dmSenderType: number;
  dmRecipient: string | null;
  dmRecipientAddress: string | null;
  dmAmbiguousRecipient?: boolean | null;
  dmSenderOrgUnit: string | null;
  dmSenderOrgUnitNum: number | null;
  dbIDRecipient: tIdDb | null;
  dmRecipientOrgUnit: string | null;
  dmRecipientOrgUnitNum: number | null;
  dmToHands: string | null;
  dmAnnotation: string | null;
  dmRecipientRefNumber: string | null;
  dmSenderRefNumber: string | null;
  dmRecipientIdent: string | null;
  dmSenderIdent: string | null;
  dmLegalTitleLaw: number | null;
  dmLegalTitleYear: number | null;
  dmLegalTitleSect: string | null;
  dmLegalTitlePar: string | null;
  dmLegalTitlePoint: string | null;
  dmPersonalDelivery: boolean | null;
  dmAllowSubstDelivery: boolean | null;
  dmMessageStatus: number;
  dmAttachmentSize: number | null;
  dmDeliveryTime: string | null;
  dmAcceptanceTime: string | null;
  dmType?: string;
  dmVODZ?: boolean;
  specMessFlag?: number;
}

export interface tRecordsArray {
  dmRecord: tRecord[];
}

export interface tListOfSentInput {
  dmFromTime: string | null;
  dmToTime: string | null;
  dmSenderOrgUnitNum: number | null;
  dmStatusFilter: string;
  dmOffset: number | null;
  dmLimit: number | null;
}

export interface tListOfMessOutput {
  dmRecords?: tRecordsArray | null;
  dmStatus: tStatus;
}

export interface tListOfFReceivedInput {
  dmFromTime: string | null;
  dmToTime: string | null;
  dmRecipientOrgUnitNum: number | null;
  dmStatusFilter: string;
  dmOffset: number | null;
  dmLimit: number | null;
}

export interface tIDMessInput {
  dmID: tIdDm;
}

export interface tMessDownOutput {
  dmReturnedMessage?: tReturnedMessage | null;
  dmStatus?: tStatus;
}

export interface tMessEnvelDownOutput {
  dmReturnedMessageEnvelope?: tReturnedMessageEnvelope | null;
  dmStatus: tStatus;
}

export interface tSignedMessDownOutput {
  dmSignature?: string;
  dmStatus?: tStatus;
}

export interface tMarkMessOutput {
  dmStatus: tStatus;
}

export interface tAuthenticateMessageInput {
  dmMessage: string;
}

export interface tAuthenticateMessageOutput {
  dmAuthResult?: boolean | null;
  dmStatus: tStatus;
}

export interface tGetStateChangesInput {
  dmFromTime: string | null;
  dmToTime: string | null;
}

export interface tStateChangesRecord {
  dmID: tIdDm;
  dmEventTime: string;
  dmMessageStatus: number;
}

export interface tStateChangesArray {
  dmRecord: tStateChangesRecord[];
}

export interface tGetStateChangesOutput {
  dmRecords?: tStateChangesArray | null;
  dmStatus: tStatus;
}

export interface tDummyOutput {
  dmStatus: tStatus;
}

export interface tGetAuthorInput {
  dmID: tIdDm;
}

export interface tGetAuthorOutput {
  userType?: string | null;
  authorName?: string | null;
  dmStatus: tStatus;
}

export interface tEraseMessageIntput {
  dmID: tIdDm;
  dmIncoming: boolean;
}

export interface tEraseMessageOutput {
  dmStatus: tStatus;
}

export interface tResignDocInput {
  dmDoc: string;
}

export interface tResignDocOutput {
  dmResultDoc: string | null;
  dmValidTo?: string;
  dmStatus: tStatus;
}

export interface tGetListOfErasedInput {
  dmFromDate?: string;
  dmToDate?: string;
  dmYear?: number;
  dmMonth?: number;
  dmMessageType: "SENT" | "RECEIVED";
  dmOutFormat: "XML" | "CSV";
}

export interface tGetListOfErasedOutput {
  asyncID?: string;
  dmStatus: tStatus;
}

export interface tPickUpAsyncInput {
  asyncID: string;
  asyncReqType: string;
}

export interface tPickUpAsyncOutput {
  asyncReqType?: string;
  asyncResponse?: string;
  dmStatus: tStatus;
}

export interface tListForNotifInput {
  ntfFromTime: string;
  ntfScope: string;
}

export interface tListForNotifOutput {
  ntfRecords?: tNtfRecordsArray | null;
  ntfListContinues?: boolean;
  dmStatus: tStatus;
}

export interface tNtfRecordsArray {
  ntfRecord: tNtfRecord[];
}

export interface tNtfRecord {
  ntfType: number;
  dmID: tIdDm;
  dmPersonalDelivery: number;
  dmDeliveryTime: string;
  dbIDRecipient: tIdDb;
  dmAnnotation: string;
  dbIDSender: tIdDb;
  dmSender: string;
}

export interface tBigMessageInput {
  dmEnvelope: tBigMessEnvelope;
  dmFiles: {
  dmExtFile: {
  dmFileMetaType: string;
  dmAttID: string;
  dmAttHash1: string;
  dmAttHash1Alg: string;
  dmAttHash2: string;
  dmAttHash2Alg: string;
  dmFileGuid?: string;
  dmUpFileGuid?: string;
}[];
  dmFile?: {
  dmEncodedContent: string;
  dmFileMetaType: string;
  dmFileDescr: string;
  dmMimeType: string;
  dmFileGuid?: string;
  dmUpFileGuid?: string;
}[];
};
}

export interface tBigMessEnvelope {
  dmSenderOrgUnit?: string | null;
  dmSenderOrgUnitNum?: number | null;
  dbIDRecipient: tIdDb | null;
  dmRecipientOrgUnit?: string | null;
  dmRecipientOrgUnitNum?: number | null;
  dmToHands?: string | null;
  dmAnnotation: string | null;
  dmRecipientRefNumber?: string | null;
  dmSenderRefNumber?: string | null;
  dmRecipientIdent?: string | null;
  dmSenderIdent?: string | null;
  dmLegalTitleLaw?: number | null;
  dmLegalTitleYear?: number | null;
  dmLegalTitleSect?: string | null;
  dmLegalTitlePar?: string | null;
  dmLegalTitlePoint?: string | null;
  dmPersonalDelivery?: boolean | null;
  dmAllowSubstDelivery?: boolean | null;
  dmOVM?: boolean | null;
  dmPublishOwnID?: {
  value: boolean;
  IdLevel?: number;
} | null;
  dmType?: string;
}

export interface tBigMessageOutput {
  dmID?: tIdDm;
  dmStatus: tStatus;
}

export interface tIdDBInput {
  dbID: tIdDb;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tIdDBDUInput {
  dbID: tIdDb;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tIdDBInputAttrs {
  dbID: {
  value: tIdDb;
  guid?: string;
  subject?: string;
  branch?: string;
};
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tIdDBDUInputAttrs2 {
  dbID: {
  value: tIdDb;
  guid?: string;
  subject?: string;
  branch?: string;
};
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tReqStatusOutput {
  dbStatus: tDbReqStatus;
}

export interface tDbReqStatus {
  dbStatusCode: string;
  dbStatusMessage: string;
  dbStatusRefNumber?: string | null;
}

export interface tDbUserInfo {
  pnFirstName: string | null;
  pnMiddleName: string | null;
  pnLastName: string | null;
  pnLastNameAtBirth: string | null;
  adCity: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  biDate: string | null;
  userID: tUserID | null;
  userType: tUserType | null;
  userPrivils: number | null;
  ic: string | null;
  firmName: string | null;
  caStreet: string | null;
  caCity: string | null;
  caZipCode: string | null;
  caState?: string | null;
}

export interface tDbUserInfoExt {
  pnFirstName: string | null;
  pnMiddleName: string | null;
  pnLastName: string | null;
  pnLastNameAtBirth: string | null;
  adCity: string | null;
  adDistrict?: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  adAMCode?: string | null;
  biDate: string | null;
  userID: tUserID | null;
  userType: tUserType | null;
  userPrivils: number | null;
  ic: string | null;
  firmName: string | null;
  caStreet: string | null;
  caCity: string | null;
  caZipCode: string | null;
  caState?: string | null;
}

export interface tDbUserInfoExt2 {
  aifoIsds: boolean;
  pnGivenNames: string | null;
  pnLastName: string | null;
  adCode: string | null;
  adCity: string | null;
  adDistrict: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  biDate: string | null;
  isdsID: string | null;
  userType: tUserType | null;
  userPrivils: number | null;
  ic: string | null;
  firmName: string | null;
  caStreet: string | null;
  caCity: string | null;
  caZipCode: string | null;
  caState?: string | null;
}

export interface tDbOwnerInfo {
  dbID: tIdDb | null;
  dbType: tDbType | null;
  ic: tIdentificationNumber | null;
  pnFirstName: string | null;
  pnMiddleName: string | null;
  pnLastName: string | null;
  pnLastNameAtBirth: string | null;
  firmName: string | null;
  biDate: string | null;
  biCity: string | null;
  biCounty: string | null;
  biState: string | null;
  adCity: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  nationality: string | null;
  email?: string | null;
  telNumber?: string | null;
  identifier: string | null;
  registryCode: string | null;
  dbState: number | null;
  dbEffectiveOVM: boolean | null;
  dbOpenAddressing: boolean | null;
}

export interface tDbOwnerInfoExt {
  dbID: tIdDb | null;
  dbType: tDbType | null;
  ic: tIdentificationNumber | null;
  pnFirstName: string | null;
  pnMiddleName: string | null;
  pnLastName: string | null;
  pnLastNameAtBirth: string | null;
  firmName: string | null;
  biDate: string | null;
  biCity: string | null;
  biCounty: string | null;
  biState: string | null;
  adCity: string | null;
  adDistrict?: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  adAMCode?: string | null;
  nationality: string | null;
  email?: string | null;
  telNumber?: string | null;
  identifier: string | null;
  registryCode: string | null;
  dbState: number | null;
  dbEffectiveOVM: boolean | null;
  dbOpenAddressing: boolean | null;
}

export interface tDbOwnerInfoExt2 {
  dbID: tIdDb | null;
  aifoIsds?: boolean | null;
  dbType: tDbType | null;
  ic: tIdentificationNumber | null;
  pnGivenNames: string | null;
  pnLastName: string | null;
  firmName: string | null;
  biDate: string | null;
  biCity: string | null;
  biCounty: string | null;
  biState: string | null;
  adCode: string | null;
  adCity: string | null;
  adDistrict: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  nationality: string | null;
  dbIdOVM: string | null;
  dbState: number | null;
  dbOpenAddressing: boolean | null;
  dbUpperID: tIdDb | null;
}

export interface tDbOwnerInfoExt21 {
  dbID: tIdDb | null;
  aifoIsds?: boolean | null;
  dbType: "OVM" | "OVM_MAIN" | "OVM_REQ" | "OVM_FO" | "OVM_PFO" | "OVM_PO" | "PO" | "PO_BASE" | "PO_REQ" | "PFO" | "PFO_BASE" | "PFO_REQ" | "PFO_ADVOK" | "PFO_INSSPR" | "PFO_DANPOR" | "PFO_AUDITOR" | "PFO_ZNALEC" | "PFO_TLUMOCNIK" | "PFO_ARCH" | "PFO_AIAT" | "PFO_AZI" | "FO" | null;
  ic: tIdentificationNumber | null;
  pnGivenNames: string | null;
  pnLastName: string | null;
  firmName: string | null;
  biDate: string | null;
  biCity: string | null;
  biCounty: string | null;
  biState: string | null;
  adCode: string | null;
  adCity: string | null;
  adDistrict: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  nationality: string | null;
  dbIdOVM: string | null;
  dbState: number | null;
  dbOpenAddressing: boolean | null;
  dbUpperID: tIdDb | null;
}

export interface tDbOwnersArray {
  dbOwnerInfo: tDbOwnerInfoExt[];
}

export interface tDbOwnersArray2 {
  dbOwnerInfo: tDbOwnerInfoExt2[];
}

export interface tDbUsersArray {
  dbUserInfo: tDbUserInfoExt & {
  AIFOTicket?: string;
}[];
}

export interface tDbUsersArray2 {
  dbUserInfo: tDbUserInfoExt2 & {
  AIFOTicket?: string;
}[];
}

export interface tFindDBInput {
  dbOwnerInfo: tDbOwnerInfo;
}

export interface tFindDBOuput {
  dbResults?: tDbOwnersArray | null;
  dbStatus: tDbReqStatus;
}

export interface tFindDBInput2 {
  dbOwnerInfo: tDbOwnerInfoExt2;
}

export interface tFindDBInput21 {
  dbOwnerInfo: tDbOwnerInfoExt21;
}

export interface tFindDBOuput2 {
  dbResults?: tDbOwnersArray2 | null;
  dbStatus: tDbReqStatus;
}

export interface tCreateDBInput {
  dbOwnerInfo: tDbOwnerInfoExt & {
  guid?: string;
  formdataid?: string;
  identityDocumentNum?: string;
  identityDocumentType?: string;
  PDZ?: string;
};
  dbPrimaryUsers: tDbUsersArray;
  dbFormerNames?: string | null;
  dbUpperDBId?: tIdDb | null;
  dbCEOLabel?: string | null;
  dbVirtual?: boolean | null;
  email?: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tCreateDBOutput {
  dbID?: tIdDb | null;
  dbUserID?: tUserID | null;
  dbAccessDataId?: tDbAccessDataId | null;
  dbStatus: tDbReqStatus;
}

export interface tCreateDBInput2 {
  dbOwnerInfo: tDbOwnerInfoExt2 & {
  guid?: string;
  subject?: string;
  branch?: string;
  formdataid?: string;
  identityDocumentNum?: string;
  identityDocumentType?: string;
  PDZ?: string;
};
  pnLastNameAtBirth?: string | null;
  notifEmail?: string | null;
  dbPrimaryUsers: tDbUsersArray2;
  dbVirtual?: boolean | null;
  email?: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tCreateDBOutput2 {
  dbID?: tIdDb | null;
  dbUserID?: tUserID | null;
  dbAccessDataId?: tDbAccessDataId | null;
  dbStatus: tDbReqStatus;
}

export interface tDeleteDBInput {
  dbOwnerInfo: tDbOwnerInfo;
  dbOwnerTerminationDate: string;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tDeleteDBInput2 {
  dbID: tIdDb;
  dbOwnerTerminationDate: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tUpdateDBInput2 {
  dbID: {
  value: tIdDb;
  guid?: string;
  subject?: string;
  branch?: string;
};
  dbNewOwnerInfo: tDbOwnerInfoExt2;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tUpdateDBInput {
  dbOldOwnerInfo: tDbOwnerInfoExt;
  dbNewOwnerInfo: tDbOwnerInfoExt;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tAddDBUserInput {
  dbOwnerInfo: tDbOwnerInfoExt;
  dbUserInfo: tDbUserInfoExt & {
  AIFOTicket?: string;
};
  dbVirtual?: boolean;
  email?: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tAddDBUserOutput {
  dbID?: tIdDb | null;
  dbAccessDataId?: tDbAccessDataId | null;
  dbStatus: tDbReqStatus;
}

export interface tAddDBUserInput2 {
  dbID: {
  value: tIdDb;
  guid?: string;
  subject?: string;
  branch?: string;
};
  dbUserInfo: tDbUserInfoExt2 & {
  AIFOTicket?: string;
};
  dbVirtual?: boolean;
  email?: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tAddDBUserOutput2 {
  dbID?: tIdDb | null;
  dbAccessDataId?: tDbAccessDataId | null;
  dbStatus: tDbReqStatus;
}

export interface tDelDBUserInput {
  dbOwnerInfo: tDbOwnerInfo;
  dbUserInfo: tDbUserInfo;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tDelDBUserInput2 {
  dbID: {
  value: tIdDb;
  guid?: string;
  subject?: string;
  branch?: string;
};
  isdsID: tIsdsID;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tUpdDBUserInput {
  dbOwnerInfo: tDbOwnerInfoExt;
  dbOldUserInfo: tDbUserInfoExt;
  dbNewUserInfo: tDbUserInfoExt;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tUpdDBUserInput2 {
  dbID: {
  value: tIdDb;
  guid?: string;
  subject?: string;
  branch?: string;
};
  isdsID: tIsdsID;
  dbNewUserInfo: tDbUserInfoExt2;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tNewAccDataInput {
  dbOwnerInfo: tDbOwnerInfo;
  dbUserInfo: tDbUserInfo;
  dbFeePaid: boolean;
  dbVirtual?: boolean;
  email?: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tNewAccDataOutput {
  dbUserID?: tUserID;
  dbAccessDataId?: tDbAccessDataId | null;
  dbStatus: tDbReqStatus;
}

export interface tNewAccDataInput2 {
  dbID: {
  value: tIdDb;
  guid?: string;
  subject?: string;
  branch?: string;
};
  isdsID: tIsdsID;
  dbFeePaid: boolean;
  dbVirtual?: boolean;
  email?: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tNewAccDataOutput2 {
  dbUserID?: tUserID;
  dbAccessDataId?: tDbAccessDataId | null;
  dbStatus: tDbReqStatus;
}

export interface tOwnerInfoInput {
  dbOwnerInfo: tDbOwnerInfo;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tDisableExternallyInput {
  dbOwnerInfo: tDbOwnerInfo;
  dbOwnerDisableDate: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tDisableExternallyInput2 {
  dbID: {
  value: tIdDb;
  guid?: string;
  subject?: string;
  branch?: string;
};
  dbOwnerDisableDate: string | null;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tGetDBUsers2Output {
  dbUsers?: tDbUsersArray2;
  dbStatus: tDbReqStatus;
}

export interface tCheckDBOutput {
  dbState?: number;
  dbStatus: tDbReqStatus;
}

export interface tDummyInput {
  dbDummy: string;
}

export interface tGetOwnInfoOutput2 {
  dbOwnerInfo: tDbOwnerInfoExt2;
  dbStatus: tDbReqStatus;
}

export interface tGetUserInfoOutput2 {
  dbUserInfo?: tDbUserInfoExt2;
  dbStatus: tDbReqStatus;
}

export interface tGetOwnInfoOutput {
  dbOwnerInfo: tDbOwnerInfo;
  dbStatus: tDbReqStatus;
}

export interface tGetUserInfoOutput {
  dbUserInfo?: tDbUserInfo;
  dbStatus: tDbReqStatus;
}

export interface tGetPasswInfoOutput {
  pswExpDate?: string | null;
  dbStatus: tDbReqStatus;
}

export interface tChngPasswInput {
  dbOldPassword: string;
  dbNewPassword: string;
}

export interface tGetDBListInput {
  dblType: string | null;
}

export interface tGetDBListOutput {
  dblData?: string | null;
  dbStatus: tDbReqStatus;
}

export interface tDeleteDBPromptlyInput {
  dbID: tIdDb;
  dbApproved?: boolean | null;
  dbExternRefNumber?: string | null;
}

export interface tPDZInfoInput {
  PDZSender: tIdDb;
}

export interface tPDZRec {
  PDZType: string;
  PDZRecip: tIdDb | null;
  PDZPayer: tIdDb;
  PDZExpire: string | null;
  PDZCnt: number | null;
  ODZIdent: string | null;
}

export interface tPDZRecArray {
  dbPDZRecord: tPDZRec[];
}

export interface tPDZInfoOutput {
  dbPDZRecords?: tPDZRecArray;
  dbStatus: tDbReqStatus;
}

export interface tChangeDBsTypeInput {
  refNumber: string;
  newDBType: string;
  IDsFile: string;
}

export interface tChangeDBsTypeOutput {
  changeLogFile?: string;
  dbStatus: tDbReqStatus;
}

export interface tChangeLogRow {
  changeLogRow?: string[] | null;
}

export interface tDBCreditInfoInput {
  dbID: tIdDb;
  ciFromDate: string | null;
  ciTodate: string | null;
}

export interface tDBCreditInfoOutput {
  currentCredit?: number;
  notifEmail?: string | null;
  ciRecords?: {
  ciRecord?: tCiRecord[] | null;
};
  dbStatus: tDbReqStatus;
}

export interface tCiRecord {
  ciEventTime: string;
  ciEventType: number;
  ciCreditChange: number;
  ciCreditAfter: number;
  ciTransID?: string;
  ciRecipientID?: tIdDb;
  ciPDZID?: string;
  ciNewCapacity?: number;
  ciNewFrom?: string;
  ciNewTo?: string;
  ciOldCapacity?: number | null;
  ciOldFrom?: string | null;
  ciOldTo?: string | null;
  ciDoneBy?: string | null;
}

export interface tISDSSearchInput {
  searchText: string;
  searchType: "GENERAL" | "ADDRESS" | "ICO" | "DBID" | null;
  searchScope: "ALL" | "OVM" | "OVM_MAIN" | "OVM_REQ" | "OVM_FO" | "OVM_PFO" | "OVM_PO" | "PO" | "PO_BASE" | "PO_REQ" | "PFO" | "PFO_BASE" | "PFO_REQ" | "PFO_ADVOK" | "PFO_DANPOR" | "PFO_AUDITOR" | "PFO_ZNALEC" | "PFO_TLUMOCNIK" | "PFO_ARCH" | "PFO_AIAT" | "PFO_AZI" | "FO" | null;
  page: number | null;
  pageSize: number | null;
  highlighting?: boolean | null;
}

export interface tISDSSearchOutput {
  totalCount?: number;
  currentCount?: number;
  position?: number;
  lastPage?: boolean;
  dbResults?: tdbResultsArray;
  dbStatus: tDbReqStatus;
}

export interface tdbResult {
  dbID: tIdDb;
  dbType: tDbType;
  dbName: string;
  dbAddress: string;
  dbBiDate: string | null;
  dbICO: tIdentificationNumber | null;
  dbEffectiveOVM: boolean;
  dbSendOptions: "DZ" | "ALL" | "PDZ" | "NONE" | "DISABLED";
}

export interface tdbResultsArray {
  dbResult: tdbResult[];
}

export interface tISDSSearchInput3 {
  searchText: string;
  searchType: "GENERAL" | "ADDRESS" | "ICO" | "IDOVM" | "DBID" | null;
  searchScope: "ALL" | "OVM" | "OVM_MAIN" | "OVM_REQ" | "OVM_FO" | "OVM_PFO" | "OVM_PO" | "PO" | "PO_BASE" | "PO_REQ" | "PFO" | "PFO_BASE" | "PFO_REQ" | "PFO_ADVOK" | "PFO_DANPOR" | "PFO_AUDITOR" | "PFO_ZNALEC" | "PFO_TLUMOCNIK" | "PFO_ARCH" | "PFO_AIAT" | "PFO_AZI" | "FO" | null;
  page: number | null;
  pageSize: number | null;
  highlighting?: boolean | null;
}

export interface tISDSSearchOutput2 {
  totalCount?: number;
  currentCount?: number;
  position?: number;
  lastPage?: boolean;
  dbResults?: tdbResultsArray2;
  dbStatus: tDbReqStatus;
}

export interface tdbResult2 {
  dbID: tIdDb;
  dbType: tDbType;
  dbName: string;
  dbAddress: string;
  dbBiDate: string | null;
  dbICO: tIdentificationNumber | null;
  dbIdOVM: string | null;
  dbSendOptions: "DZ" | "ALL" | "PDZ" | "NONE" | "DISABLED";
}

export interface tdbResultsArray2 {
  dbResult: tdbResult2[];
}

export interface tGetDBStatusInput {
  dbID: tIdDb | null;
  baFrom: string;
  baTo: string;
}

export interface tGetDBStatusOutput {
  dbID?: tIdDb;
  Periods?: tdbPeriodsArray;
  dbStatus: tDbReqStatus;
}

export interface tdbPeriodsArray {
  Period: tdbPeriod[];
}

export interface tdbPeriod {
  PeriodFrom: string;
  PeriodTo: string;
  DbState: number;
}

export interface tFindPersonalDBInput {
  dbOwnerInfo: tdbPersonalOwnerInfo;
}

export interface tdbPersonalOwnerInfo {
  dbID: tIdDb | null;
  aifoIsds: boolean | null;
  pnFirstName: string | null;
  pnMiddleName: string | null;
  pnLastName: string | null;
  biDate: string | null;
  biCity: string | null;
  biCounty: string | null;
  biState: string | null;
  adCode: number | null;
  adCity: string | null;
  adDistrict: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  nationality: string | null;
}

export interface tFindPersonalDBOutput {
  dbResults?: tdbPersOwnersArray | null;
  dbStatus: tDbReqStatus;
}

export interface tdbPersOwnersArray {
  dbOwnerInfo: tdbPersonalOwnerInfo[];
}

export interface tDTInfoInput {
  dbId: tIdDb;
}

export interface tDTInfoOutput {
  ActDTType?: number;
  ActDTCapacity?: number | null;
  ActDTFrom?: string | null;
  ActDTTo?: string | null;
  ActDTCapUsed?: number | null;
  FutDTType?: number;
  FutDTCapacity?: number | null;
  FutDTFrom?: string | null;
  FutDTTo?: string | null;
  FutDTPaid?: number | null;
  dbStatus: tDbReqStatus;
}

export interface tPDZSendInput {
  dbId: tIdDb;
  PDZType: "Normal" | "Init" | "VoDZ" | null;
}

export interface tPDZSendOutput {
  PDZsiResult?: boolean | null;
  dbStatus: tDbReqStatus;
}

export interface tGetConstsOutput {
  constRecords?: {
  constRecord: tConstRecord[];
};
  dbStatus: tDbReqStatus | null;
}

export interface tConstRecord {
  cName: string;
  cValue: string;
  cFrom: string;
  cTo: string;
}

export interface tGetAddressOutput {
  adCode: string | null;
  adCity: string | null;
  adDistrict: string | null;
  adStreet: string | null;
  adNumberInStreet: string | null;
  adNumberInMunicipality: string | null;
  adZipCode: string | null;
  adState: string | null;
  adRegistrationNumber: string | null;
  adFullAddress1: string | null;
  adFullAddress2: string | null;
}

export type dmStatus = tStatus;

export type CreateMultipleMessage = tMultipleMessageCreateInput;

export type CreateMultipleMessageResponse = tMultipleMessageCreateOutput;

export type CreateMessage = tMessageCreateInput;

export type CreateMessageResponse = tMessageCreateOutput;

export type VerifyMessage = tIDMessInput;

export type VerifyMessageResponse = tMessageVerifyOutput;

export type GetDeliveryInfo = tIDMessInput;

export type GetDeliveryInfoResponse = tDeliveryMessageOutput;

export type GetSignedDeliveryInfo = tIDMessInput;

export type GetSignedDeliveryInfoResponse = tSignDelivMessOutput;

export type GetListOfSentMessages = tListOfSentInput;

export type GetListOfSentMessagesResponse = tListOfMessOutput;

export type GetListOfReceivedMessages = tListOfFReceivedInput;

export type GetListOfReceivedMessagesResponse = tListOfMessOutput;

export type MessageDownload = tIDMessInput;

export type MessageDownloadResponse = tMessDownOutput;

export type MessageEnvelopeDownload = tIDMessInput;

export type MessageEnvelopeDownloadResponse = tMessEnvelDownOutput;

export type SignedMessageDownload = tIDMessInput;

export type SignedMessageDownloadResponse = tSignedMessDownOutput;

export type MarkMessageAsDownloaded = tIDMessInput;

export type MarkMessageAsDownloadedResponse = tMarkMessOutput;

export type SignedSentMessageDownload = tIDMessInput;

export type SignedSentMessageDownloadResponse = tSignedMessDownOutput;

export type AuthenticateMessage = tAuthenticateMessageInput;

export type AuthenticateMessageResponse = tAuthenticateMessageOutput;

export type GetMessageStateChanges = tGetStateChangesInput;

export type GetMessageStateChangesResponse = tGetStateChangesOutput;

export type DummyOperation = string;

export type DummyOperationResponse = tDummyOutput;

export type GetMessageAuthor = tGetAuthorInput;

export type GetMessageAuthorResponse = tGetAuthorOutput;

export type EraseMessage = tEraseMessageIntput;

export type EraseMessageResponse = tEraseMessageOutput;

export type Re_signISDSDocument = tResignDocInput;

export type Re_signISDSDocumentResponse = tResignDocOutput;

export type GetListOfErasedMessages = tGetListOfErasedInput;

export type GetListOfErasedMessagesResponse = tGetListOfErasedOutput;

export type PickUpAsyncResponse = tPickUpAsyncInput;

export type PickUpAsyncResponseResponse = tPickUpAsyncOutput;

export type GetListForNotifications = tListForNotifInput;

export type GetListForNotificationsResponse = tListForNotifOutput;

export interface RegisterForNotifications {
  action: number;
}

export interface RegisterForNotificationsResponse {
  dmStatus: tStatus;
}

export interface UploadAttachment {
  dmFile: {
  dmEncodedContent: string;
  dmMimeType: string;
  dmFileDescr: string;
};
}

export interface UploadAttachmentResponse {
  dmAttID?: string;
  dmAttHash1?: {
  value: string;
  AttHashAlg?: string;
};
  dmAttHash2?: {
  value: string;
  AttHashAlg?: string;
};
  dmStatus: tStatus;
}

export interface DownloadAttachment {
  dmID: string;
  attNum: number;
}

export interface DownloadAttachmentResponse {
  dmFile?: {
  dmEncodedContent: string;
  dmFileMetaType?: string;
  dmMimeType?: string;
  dmFileDescr?: string;
};
  dmStatus: tStatus;
}

export type CreateBigMessage = tBigMessageInput;

export type CreateBigMessageResponse = tBigMessageOutput;

export interface AuthenticateBigMessage {
  dmMessage: string;
}

export interface AuthenticateBigMessageResponse {
  dmAuthResult?: boolean | null;
  dmStatus: tStatus;
}

export interface SignedBigMessageDownload {
  dmID: tIdDm;
}

export interface SignedBigMessageDownloadResponse {
  dmSignature?: string;
  dmStatus: tStatus;
}

export interface SignedSentBigMessageDownload {
  dmID: tIdDm;
}

export interface SignedSentBigMessageDownloadResponse {
  dmSignature?: string;
  dmStatus: tStatus;
}

export interface BigMessageDownload {
  dmID: tIdDm;
}

export interface BigMessageDownloadResponse {
  dmReturnedMessage?: {
  dmDm: {
  dmID: tIdDm;
  dbIDSender: tIdDb | null;
  dmSender: string | null;
  dmSenderAddress: string | null;
  dmSenderType: number;
  dmRecipient: string | null;
  dmRecipientAddress: string | null;
  dmAmbiguousRecipient?: boolean | null;
  dmSenderOrgUnit: string | null;
  dmSenderOrgUnitNum: number | null;
  dbIDRecipient: tIdDb | null;
  dmRecipientOrgUnit: string | null;
  dmRecipientOrgUnitNum: number | null;
  dmToHands: string | null;
  dmAnnotation: string | null;
  dmRecipientRefNumber: string | null;
  dmSenderRefNumber: string | null;
  dmRecipientIdent: string | null;
  dmSenderIdent: string | null;
  dmLegalTitleLaw: number | null;
  dmLegalTitleYear: number | null;
  dmLegalTitleSect: string | null;
  dmLegalTitlePar: string | null;
  dmLegalTitlePoint: string | null;
  dmPersonalDelivery: boolean | null;
  dmAllowSubstDelivery: boolean | null;
  dmFiles: tFilesArray;
};
  dmHash: tHash;
  dmQTimestamp: string | null;
  dmDeliveryTime: string | null;
  dmAcceptanceTime: string | null;
  dmMessageStatus: number;
  dmAttachmentSize: number | null;
  dmType?: tDmType;
  dmVODZ?: boolean;
  attsNum?: number;
  specMessFlag?: number;
} | null;
  dmStatus: tStatus;
}

export type GetMessageAuthor2 = tGetAuthorInput;

export interface GetMessageAuthor2Response {
  dmMessageAuthor?: {
  maItem: {
  key: string;
  value: string;
}[];
};
  dmStatus: tStatus;
}

export interface SentMessageEnvelopeDownload {
  dmID: tIdDm;
}

export interface SentMessageEnvelopeDownloadResponse {
  dmReturnedMessageEnvelope?: tReturnedMessageEnvelope | null;
  dmStatus: tStatus;
}

export interface SuspMessageReport {
  dmID: tIdDm;
  repName?: string;
  repMail?: string;
  repTel?: string;
  allowComplete: boolean;
  note?: string;
}

export interface SuspMessageReportResponse {
  dmStatus: tStatus;
}

export interface ArchiveISDSDocument {
  dmMessage: string;
}

export interface ArchiveISDSDocumentResponse {
  dmResultDoc: string | null;
  nextStampTo: string | null;
  dmStatus: tStatus;
}

export type dbStatus = tDbReqStatus;

export type FindDataBox = tFindDBInput;

export type FindDataBoxResponse = tFindDBOuput;

export type FindDataBox2 = tFindDBInput21;

export type FindDataBox2Response = tFindDBOuput2;

export type CreateDataBox = tCreateDBInput;

export type CreateDataBoxResponse = tCreateDBOutput;

export type CreateDataBox2 = tCreateDBInput2;

export type CreateDataBox2Response = tCreateDBOutput2;

export type DeleteDataBox = tDeleteDBInput;

export type DeleteDataBoxResponse = tReqStatusOutput;

export type DeleteDataBox2 = tDeleteDBInput2;

export type DeleteDataBox2Response = tReqStatusOutput;

export type UpdateDataBoxDescr2 = tUpdateDBInput2;

export type UpdateDataBoxDescr2Response = tReqStatusOutput;

export type UpdateDataBoxDescr = tUpdateDBInput;

export type UpdateDataBoxDescrResponse = tReqStatusOutput;

export type AddDataBoxUser = tAddDBUserInput;

export type AddDataBoxUserResponse = tAddDBUserOutput;

export type AddDataBoxUser2 = tAddDBUserInput2;

export type AddDataBoxUser2Response = tAddDBUserOutput2;

export type DeleteDataBoxUser = tDelDBUserInput;

export type DeleteDataBoxUserResponse = tReqStatusOutput;

export type DeleteDataBoxUser2 = tDelDBUserInput2;

export type DeleteDataBoxUser2Response = tReqStatusOutput;

export type UpdateDataBoxUser = tUpdDBUserInput;

export type UpdateDataBoxUserResponse = tReqStatusOutput;

export type UpdateDataBoxUser2 = tUpdDBUserInput2;

export type UpdateDataBoxUser2Response = tReqStatusOutput;

export type NewAccessData = tNewAccDataInput;

export type NewAccessDataResponse = tNewAccDataOutput;

export type NewAccessData2 = tNewAccDataInput2;

export type NewAccessData2Response = tNewAccDataOutput2;

export type DisableDataBoxExternally = tDisableExternallyInput;

export type DisableDataBoxExternallyResponse = tReqStatusOutput;

export type DisableDataBoxExternally2 = tDisableExternallyInput2;

export type DisableDataBoxExternally2Response = tReqStatusOutput;

export type DisableOwnDataBox = tOwnerInfoInput;

export type DisableOwnDataBoxResponse = tReqStatusOutput;

export type DisableOwnDataBox2 = tIdDBInputAttrs;

export type DisableOwnDataBox2Response = tReqStatusOutput;

export type EnableOwnDataBox = tOwnerInfoInput;

export type EnableOwnDataBoxResponse = tReqStatusOutput;

export type EnableOwnDataBox2 = tIdDBInputAttrs;

export type EnableOwnDataBox2Response = tReqStatusOutput;

export type GetDataBoxUsers2 = tIdDBInput;

export type GetDataBoxUsers2Response = tGetDBUsers2Output;

export type CheckDataBox = tIdDBInput;

export type CheckDataBoxResponse = tCheckDBOutput;

export type SetOpenAddressing = tIdDBInputAttrs;

export type SetOpenAddressingResponse = tReqStatusOutput;

export type ClearOpenAddressing = tIdDBInputAttrs;

export type ClearOpenAddressingResponse = tReqStatusOutput;

export type GetOwnerInfoFromLogin2 = tDummyInput;

export type GetOwnerInfoFromLogin2Response = tGetOwnInfoOutput2;

export type GetUserInfoFromLogin2 = tDummyInput;

export type GetUserInfoFromLogin2Response = tGetUserInfoOutput2;

export type GetOwnerInfoFromLogin = tDummyInput;

export type GetOwnerInfoFromLoginResponse = tGetOwnInfoOutput;

export type GetUserInfoFromLogin = tDummyInput;

export type GetUserInfoFromLoginResponse = tGetUserInfoOutput;

export type GetPasswordInfo = tDummyInput;

export type GetPasswordInfoResponse = tGetPasswInfoOutput;

export type ChangeISDSPassword = tChngPasswInput;

export type ChangeISDSPasswordResponse = tReqStatusOutput;

export type GetDataBoxList = tGetDBListInput;

export type GetDataBoxListResponse = tGetDBListOutput;

export type DeleteDataBoxPromptly = tDeleteDBPromptlyInput;

export type DeleteDataBoxPromptlyResponse = tReqStatusOutput;

export type PDZInfo = tPDZInfoInput;

export type PDZInfoResponse = tPDZInfoOutput;

export type ChangeBoxesType = tChangeDBsTypeInput;

export type ChangeBoxesTypeResponse = tChangeDBsTypeOutput;

export type DataBoxCreditInfo = tDBCreditInfoInput;

export type DataBoxCreditInfoResponse = tDBCreditInfoOutput;

export type ISDSSearch2 = tISDSSearchInput;

export type ISDSSearch2Response = tISDSSearchOutput;

export type ISDSSearch3 = tISDSSearchInput3;

export type ISDSSearch3Response = tISDSSearchOutput2;

export type GetDataBoxActivityStatus = tGetDBStatusInput;

export type GetDataBoxActivityStatusResponse = tGetDBStatusOutput;

export type FindPersonalDataBox = tFindPersonalDBInput;

export type FindPersonalDataBoxResponse = tFindPersonalDBOutput;

export type DTInfo = tDTInfoInput;

export type DTInfoResponse = tDTInfoOutput;

export type PDZSendInfo = tPDZSendInput;

export type PDZSendInfoResponse = tPDZSendOutput;

export interface GetConstants {
  constDate: string | null;
}

export type GetConstantsResponse = tGetConstsOutput;

export interface GetDataBoxAddress {
  dbID: tIdDb;
}

export type GetDataBoxAddressResponse = tGetAddressOutput;
