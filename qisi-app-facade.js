(function (root, factory) {
    const api = factory();

    root.Qisi = root.Qisi || {};
    root.Qisi.AppFacade = api;

    if (
        typeof module !== 'undefined' &&
        module.exports
    ) {
        module.exports = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function () {
        'use strict';

        const createAppFacade = (dependencies = {}) => ({
            getDependency: name =>
                dependencies[name] || null,

            hasDependency: name =>
                Boolean(dependencies[name]),

            assertDependency: name => {
                if (!dependencies[name]) {
                    throw new Error(`Missing dependency: ${name}`);
                }
                return dependencies[name];
            },

            getAppEnvironment: () => ({
                isBrowser:
                    typeof window !== 'undefined' && typeof document !== 'undefined',
                isNode:
                    typeof require !== 'undefined' && typeof module !== 'undefined',
                hasVue:
                    typeof Vue !== 'undefined',
                hasDexie:
                    typeof Dexie !== 'undefined'
            }),

            assertAppDependencies: requiredNames => {
                const missing = [];

                for (const name of requiredNames) {
                    if (!dependencies[name]) {
                        missing.push(name);
                    }
                }

                if (missing.length) {
                    throw new Error(
                        `Missing app dependencies: ${missing.join(', ')}`
                    );
                }

                return true;
            }
        });

        return {
            createAppFacade
        };
    }
);
