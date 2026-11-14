import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authCallback,cleanAuthUrl,authLinkMessage} from '../shared/auth-flow.mjs';
test('Email callbacks distinguish confirmation, recovery, expired links and normal URLs',()=>{
 assert.equal(authCallback('https://family.example/?area=parent'),null);
 const signup=authCallback('https://family.example/#access_token=access&refresh_token=refresh&expires_in=3600&type=signup');assert.equal(signup.kind,'confirmation');assert.equal(signup.session.expires_in,3600);
 assert.equal(authCallback('https://family.example/#access_token=access&refresh_token=refresh&type=recovery').kind,'recovery');
 assert.equal(authCallback('https://family.example/#access_token=access').kind,'error');
 assert.equal(authCallback('https://family.example/#error=access_denied&error_code=otp_expired').code,'otp_expired');
 assert.match(authLinkMessage('otp_expired'),/already used/);
});
test('Auth secrets and error parameters are removed from the return URL',()=>{
 assert.equal(cleanAuthUrl('https://family.example/?area=parent&flow=password-reset#error=access_denied&access_token=secret&refresh_token=secret'), '/?area=parent');
 assert.equal(cleanAuthUrl('https://family.example/?error_code=otp_expired&error_description=Failed'),'/');
});
