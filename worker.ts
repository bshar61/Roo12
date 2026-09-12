import application from 'vinext/server/fetch-handler';
import {runScheduledMarketWindow} from './lib/background-worker';
import type {PriceEnvironment} from './lib/price-server';

const worker={
 fetch(request:Request,environment:PriceEnvironment,context:ExecutionContext){
  return application.fetch(request,environment,context);
 },
 scheduled(_controller:ScheduledController,environment:PriceEnvironment,context:ExecutionContext){
  context.waitUntil(runScheduledMarketWindow(environment));
 },
};

export default worker;
