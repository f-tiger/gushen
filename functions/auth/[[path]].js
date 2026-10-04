import {accountRoute} from '../../frontend/fleet-account/edge.mjs';
export async function onRequest(context){return await accountRoute(context.request,context.env)||new Response('Not found',{status:404});}
