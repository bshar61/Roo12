import {sqliteTable,text,integer,index,primaryKey,real} from 'drizzle-orm/sqlite-core';
export const licenses=sqliteTable('licenses',{id:text('id').primaryKey(),hash:text('hash').notNull().unique(),label:text('label').notNull(),createdAt:integer('created_at').notNull(),activatedAt:integer('activated_at'),expiresAt:integer('expires_at'),revoked:integer('revoked').notNull().default(0),boundTo:text('bound_to')});
export const sessions=sqliteTable('sessions',{hash:text('hash').primaryKey(),licenseId:text('license_id').notNull().references(()=>licenses.id),admin:integer('admin').notNull().default(0),expiresAt:integer('expires_at').notNull()},t=>[index('idx_sessions_license').on(t.licenseId)]);
export const limits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),resetAt:integer('reset_at').notNull()});
export const settings=sqliteTable('settings',{id:text('id').primaryKey(),encrypted:text('encrypted').notNull(),updatedAt:integer('updated_at').notNull()});
export const trades=sqliteTable('trades',{id:text('id').primaryKey(),owner:text('owner').notNull(),source:text('source').notNull(),createdAt:integer('created_at').notNull(),exitAt:integer('exit_at').notNull(),result:text('result').notNull(),data:text('data').notNull()},t=>[index('idx_trades_owner_source').on(t.owner,t.source,t.createdAt)]);
export const locks=sqliteTable('signal_locks',{owner:text('owner').primaryKey(),until:integer('until').notNull()});
export const audit=sqliteTable('audit',{id:integer('id').primaryKey({autoIncrement:true}),at:integer('at').notNull(),actor:text('actor').notNull(),action:text('action').notNull(),detail:text('detail').notNull()});

export const marketCandles=sqliteTable('market_candles',{asset:text('asset').notNull(),time:integer('time').notNull(),open:real('open').notNull(),high:real('high').notNull(),low:real('low').notNull(),close:real('close').notNull(),firstAt:real('first_at').notNull(),lastAt:real('last_at').notNull(),samples:integer('samples').notNull(),maxGap:real('max_gap').notNull()},t=>[primaryKey({columns:[t.asset,t.time]})]);

export const serverConfig=sqliteTable('server_config',{id:text('id').primaryKey(),url:text('url').notNull(),checkedAt:integer('checked_at').notNull().default(0)});
